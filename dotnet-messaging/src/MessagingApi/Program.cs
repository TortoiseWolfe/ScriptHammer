using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using MessagingApi.Data;

var builder = WebApplication.CreateBuilder(args);

// ── JSON: snake_case to match the frontend's MessageRow / ConversationMeta
// contract (sender_id, encrypted_content, sequence_number, read_at, ...). The
// row entities use [Column("snake")] for the DB; this makes the JSON match too.
builder.Services
    .AddControllers()
    .AddJsonOptions(o =>
    {
        o.JsonSerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower;
        o.JsonSerializerOptions.DictionaryKeyPolicy = JsonNamingPolicy.SnakeCaseLower;
        o.JsonSerializerOptions.DefaultIgnoreCondition = JsonIgnoreCondition.Never;
    });

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

// ── Supabase JWT validation. This is the explicit replacement for auth.uid():
// the validated `sub` claim identifies the caller. Supabase signs user tokens
// with aud=authenticated. Two signing regimes are supported:
//   - CLOUD projects use ES256 (asymmetric) — validated via the project's JWKS
//     (MetadataAddress → /.well-known/jwks.json under the auth issuer).
//   - LOCAL/self-hosted GoTrue uses HS256 with SUPABASE_JWT_SECRET (symmetric).
// Both signing keys are offered so either token type validates.
var jwtSecret = builder.Configuration["SUPABASE_JWT_SECRET"];
var supabaseUrl = builder.Configuration["SUPABASE_URL"]; // e.g. https://<ref>.supabase.co

var signingKeys = new List<SecurityKey>();
if (!string.IsNullOrEmpty(jwtSecret))
    signingKeys.Add(new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret)));

builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        if (!string.IsNullOrEmpty(supabaseUrl))
        {
            // JwtBearer fetches + caches the ES256 public keys from here.
            var issuer = $"{supabaseUrl.TrimEnd('/')}/auth/v1";
            options.MetadataAddress = $"{issuer}/.well-known/openid-configuration";
            options.RequireHttpsMetadata = supabaseUrl.StartsWith("https");
        }

        options.TokenValidationParameters = new TokenValidationParameters
        {
            // Accept both the JWKS-fetched ES256 keys (via MetadataAddress) AND
            // the static HS256 secret. IssuerSigningKeys augments, not replaces,
            // the keys the metadata resolver supplies.
            ValidateIssuerSigningKey = true,
            IssuerSigningKeys = signingKeys,
            // Supabase iss varies (supabase-demo locally, the project URL on
            // cloud); we validate the signature + audience, not the issuer.
            ValidateIssuer = false,
            ValidateAudience = true,
            ValidAudience = "authenticated",
            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromSeconds(30),
            // Supabase puts the user id in `sub`; keep it as-is (don't remap to
            // the long ClaimTypes URI) so CallerContext can read "sub" directly.
            NameClaimType = "sub",
            RoleClaimType = "role",
        };
    });

builder.Services.AddAuthorization();

// ── CORS: the browser calls this API from the Next.js origin. basePath
// (/ScriptHammer) is a path, not part of the CORS origin, so allow the bare
// scheme+host+port for the dev ports the app runs on.
var corsOrigins =
    builder.Configuration["CORS_ORIGINS"]?.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
    ?? new[]
    {
        "http://localhost:3000",
        "http://localhost:3002",
        "http://127.0.0.1:3002",
    };

builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
        policy.WithOrigins(corsOrigins).AllowAnyHeader().AllowAnyMethod());
});

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.MapGet("/health", () => Results.Ok(new { status = "ok" }));

app.UseCors();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

app.Run();

// Exposed so the conformance/integration test harness can spin up the app.
public partial class Program { }
