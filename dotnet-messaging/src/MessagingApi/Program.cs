using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Mvc.Formatters;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using MessagingApi.Data;
using MessagingApi.Middleware;
using Npgsql;

var builder = WebApplication.CreateBuilder(args);

// ── JSON: snake_case to match the frontend's MessageRow / ConversationMeta
// contract (sender_id, encrypted_content, sequence_number, read_at, ...). The
// row entities use [Column("snake")] for the DB; this makes the JSON match too.
builder.Services
    .AddControllers(options =>
    {
        // A nullable GET (getConversationMeta / getMessageById) must serialize
        // JSON `null` with 200, NOT collapse to 204 No Content. By default
        // HttpNoContentOutputFormatter.TreatNullValueAsNoContent turns
        // Ok((object?)null) into a 204, which the TS provider's request<T>
        // helper maps to `undefined` — but the provider contract requires
        // `null` (C7 outsider-meta). 204 stays reserved for genuinely void
        // endpoints (archive / mark / edit / delete use NoContent() directly,
        // via NoContentResult, which bypasses output formatters). (#265)
        options.OutputFormatters.RemoveType<HttpNoContentOutputFormatter>();
    })
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
var supabaseIssuer = string.IsNullOrEmpty(supabaseUrl)
    ? null
    : $"{supabaseUrl.TrimEnd('/')}/auth/v1";

// ── Fail-closed secret guard (#265). The demo HS256 secret shipped in
// appsettings.json is a well-known value; anyone who knows it can forge
// aud=authenticated tokens. It is fine as the LOCAL dev default, but MUST NOT
// reach a non-Development environment. Refusing to boot is deliberate: a
// silent misconfiguration here is a full authentication bypass.
const string DemoJwtSecret = "super-secret-jwt-token-with-at-least-32-characters-long";
if (!builder.Environment.IsDevelopment())
{
    if (string.IsNullOrEmpty(jwtSecret) && string.IsNullOrEmpty(supabaseUrl))
    {
        throw new InvalidOperationException(
            "Refusing to start: neither SUPABASE_JWT_SECRET (HS256) nor SUPABASE_URL " +
            "(ES256/JWKS) is configured, so no access token could ever be validated. " +
            "Set one before running outside Development.");
    }
    if (jwtSecret == DemoJwtSecret)
    {
        throw new InvalidOperationException(
            "Refusing to start: SUPABASE_JWT_SECRET is the well-known demo secret. " +
            "Inject the real project JWT secret (env SUPABASE_JWT_SECRET) in " +
            "non-Development environments — the demo secret is a token-forgery vector.");
    }
}

// ── Fail-closed DB-password guard (#321). The backend logs in as the
// least-privilege dotnet_app role; locally its password is the well-known
// Supabase demo value. A shared/guessable DB password in a non-Development
// environment undermines the least-privilege boundary — RLS + the #281
// column-guard only help if the login itself isn't trivially forgeable — so
// refuse to boot rather than run with the demo credential. Mirrors the JWT
// guard above. Inject a distinct DOTNET_DB_PASSWORD in prod.
const string DemoDbPassword = "your-super-secret-and-long-postgres-password";
if (!builder.Environment.IsDevelopment())
{
    var connString = builder.Configuration.GetConnectionString("DefaultConnection");
    var dbPassword = string.IsNullOrEmpty(connString)
        ? null
        : new NpgsqlConnectionStringBuilder(connString).Password;
    if (string.IsNullOrEmpty(dbPassword))
    {
        throw new InvalidOperationException(
            "Refusing to start: the database connection has no password. Inject a " +
            "distinct DOTNET_DB_PASSWORD for the dotnet_app role in non-Development " +
            "environments.");
    }
    if (dbPassword == DemoDbPassword)
    {
        throw new InvalidOperationException(
            "Refusing to start: the dotnet_app DB password is the well-known local/demo " +
            "value. Inject a distinct DOTNET_DB_PASSWORD in non-Development environments — " +
            "a shared demo DB password undermines the least-privilege role boundary (#321).");
    }
}

var signingKeys = new List<SecurityKey>();
if (!string.IsNullOrEmpty(jwtSecret))
    signingKeys.Add(new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret)));

builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        if (supabaseIssuer is not null)
        {
            // JwtBearer fetches + caches the ES256 public keys from here.
            options.MetadataAddress = $"{supabaseIssuer}/.well-known/openid-configuration";
            options.RequireHttpsMetadata = supabaseUrl!.StartsWith("https");
        }

        options.TokenValidationParameters = new TokenValidationParameters
        {
            // Accept both the JWKS-fetched ES256 keys (via MetadataAddress) AND
            // the static HS256 secret. IssuerSigningKeys augments, not replaces,
            // the keys the metadata resolver supplies.
            ValidateIssuerSigningKey = true,
            IssuerSigningKeys = signingKeys,
            // Issuer validation is gated on SUPABASE_URL: when the project URL is
            // known (cloud/prod), pin the issuer to {url}/auth/v1 to close the
            // trust boundary. Locally SUPABASE_URL is unset — GoTrue's demo iss
            // ("supabase-demo") has no fixed URL, so we fall back to validating
            // signature + audience only. (#265)
            ValidateIssuer = supabaseIssuer is not null,
            ValidIssuer = supabaseIssuer,
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
// Set the Postgres RLS actor per authenticated request (#321) — runs after
// auth (needs HttpContext.User) and before the controllers, so their DB work
// enlists in the actor's transaction. Anonymous requests (/health) are skipped.
app.UseMiddleware<RlsActorMiddleware>();
app.MapControllers();

app.Run();

// Exposed so the conformance/integration test harness can spin up the app.
public partial class Program { }
