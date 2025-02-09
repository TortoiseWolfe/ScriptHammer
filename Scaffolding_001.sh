#!/usr/bin/env bash
set -eo pipefail

##############################################
        # Expo Setup Script Template
##############################################

#region Metadata and Configuration
# -----------------------------------------------------------------------------
# Script Name:        expo-setup.sh
# Description:        Non-Interactive Expo setup script for initializing an
#                     Expo project with configuration for Supabase, Zustand,
#                     Tailwind + NativeWind, React Hook Form, Yup-based
#                     validation, and an Expo Router authentication flow
#                     (using a Zustand store for auth state). This version
#                     includes adjustments for testing on the web and fixes
#                     navigation between sign-in and sign-up.
#                     Additionally, the Sign Up screen now provides robust
#                     error feedback if saving a new user fails.
# Author:             TurtleWolfe@ScriptHammer.com
# Created:            2025-02-08
# Version:            1.2.3
# License:            MIT
#
# Best Practices:
#   - Ensure that all environment variables are securely defined.
#   - Use meaningful variable names and consistent formatting.
#   - Document each section thoroughly for maintainability.
#   - Validate critical variables before proceeding.
# -----------------------------------------------------------------------------
#endregion

#region Environment Variables and Pre-Setup
if [ -f .env ]; then
  set -o allexport
  source .env
  set +o allexport
else
  echo "ERROR: .env file not found."
  echo "Create one with the following minimum content:"
  echo "APP_NAME=\"ScriptHammer\""
  echo "EXPO_PUBLIC_SUPABASE_URL=\"https://YOUR-PROJECT.supabase.co\""
  echo "EXPO_PUBLIC_SUPABASE_ANON_KEY=\"YOUR-ANON-KEY\""
  echo "EXPO_GOOGLE_MAPS_API_KEY=\"YOUR_GOOGLE_MAPS_API_KEY\""
  exit 1
fi

# Validate required variables
required_vars=("APP_NAME" "EXPO_PUBLIC_SUPABASE_URL" "EXPO_PUBLIC_SUPABASE_ANON_KEY" "EXPO_GOOGLE_MAPS_API_KEY")
for var in "${required_vars[@]}"; do
  if [ -z "${!var}" ]; then
    echo "ERROR: $var is not set in the .env file"
    exit 1
  fi
done
#endregion

#region Create Expo App
echo "🚀 Creating Expo app: $APP_NAME"
npx create-expo-app "$APP_NAME"

echo "📂 Entering project directory"
cd "$APP_NAME" || {
  echo "ERROR: Failed to enter directory '$APP_NAME'"
  exit 1
}

# Clean up default project files
echo "N" | npm run reset-project
rm -rf app-example
rm -f App.js App.tsx
#endregion

#region Install Dependencies
echo "📦 Installing dependencies..."

# Package arrays with commented options
core_deps=(
  "zustand"
  "@supabase/supabase-js@2"
  "@react-native-async-storage/async-storage"
  "react-native-url-polyfill"
  "react-hook-form"
  "yup"  # Yup for validation
)

expo_deps=(
  "react-native-safe-area-context"
  # "react-native-screens"
  # "expo-linking"
  # "expo-constants"
  "expo-status-bar"
  # "expo-font"
  # "expo-secure-store"
)

ui_deps=(
  "nativewind"
  # "react-native-svg"
)

dev_deps=(
  "tailwindcss@3.3.2"
  # "@types/react-native"
)

# Function to install dependencies from an array
install_deps() {
  local arr=("$@")
  for dep in "${arr[@]}"; do
    if [[ $dep != \#* ]]; then
      npm install "$dep"
    fi
  done
}

echo "📦 Installing core dependencies..."
install_deps "${core_deps[@]}"

echo "📦 Installing Expo dependencies..."
install_deps "${expo_deps[@]}"

echo "🎨 Installing UI dependencies..."
install_deps "${ui_deps[@]}"

echo "🛠️ Installing dev dependencies..."
install_deps "${dev_deps[@]}"
#endregion

#region CREATE DIRECTORY STRUCTURE
echo "📁 Creating directory structure..."

# Array-based structure definition (with quoted paths)
dir_structure=(
  # Root files
  ".env.local"
  # "app.json"
  # "babel.config.js"
  # "metro.config.js"
  # "package.json"
  # "tsconfig.json"
  
  # Source directory
  # "src/"
  # "src/app/"
  # "src/app/_layout.tsx"
  # "src/app/error.tsx"
  # "src/app/global.css"
  # "src/app/loading.tsx"
  # "src/app/not-found.tsx"
  
  # Auth route group
  "src/app/(auth)/"
  "src/app/(auth)/sign-in.tsx"
  "src/app/(auth)/sign-up.tsx"
  "src/app/(auth)/_layout.tsx"
  # Tabs route group
  "src/app/(tabs)/"
  "src/app/(tabs)/_layout.tsx"
  "src/app/(tabs)/index.tsx"
  "src/app/(tabs)/create.tsx"
  "src/app/(tabs)/explore.tsx"
  "src/app/(tabs)/groups.tsx"
  "src/app/(tabs)/map.tsx"
  "src/app/(tabs)/messages.tsx"
  "src/app/(tabs)/notifications.tsx"
  "src/app/(tabs)/profile.tsx"
  
  # Admin route group
  # "src/app/(admin)/"
  # "src/app/(admin)/_layout.tsx"
  # "src/app/(admin)/index.tsx"
  
  # Additional directories
  "src/lib/"
  "src/lib/supabase.ts"
  "src/store/"
  "src/store/useAuthStore.ts"
  # "src/store/useThemeStore.ts"
  "src/components/"
)

# Create directories and files as needed
for item in "${dir_structure[@]}"; do
  # If the item ends with a slash, create a directory; otherwise, create a file
  if [[ $item == */ ]]; then
    mkdir -p "$item"
  else
    # Create parent directory if needed
    mkdir -p "$(dirname "$item")"
    touch "$item"
  fi
done
#endregion

#region Scaffold Root Layout (Conditional Auth Routing)
echo "📝 Generating Root Layout for auth redirection at src/app/_layout.tsx..."

cat > "src/app/_layout.tsx" << 'EOF'
import { useEffect } from 'react';
import { useRouter, usePathname, Slot } from 'expo-router';
import { useAuthStore } from '../store/useAuthStore';
import { ActivityIndicator, View } from 'react-native';

export default function RootLayout() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isLoading } = useAuthStore();

  useEffect(() => {
    if (isLoading) return;
    // Define auth routes explicitly as '/sign-in' and '/sign-up'
    const isAuthRoute = pathname === '/sign-in' || pathname === '/sign-up';
    if (!user && !isAuthRoute) {
      router.replace('/sign-in');
    }
    if (user && isAuthRoute) {
      router.replace('/(tabs)/index');
    }
  }, [user, isLoading, pathname, router]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return <Slot />;
}
EOF
#endregion

#region Scaffold Auth Screens Code
echo "📝 Generating code for Auth Screens..."

# Auth Layout for authentication screens (stays the same)
cat > "src/app/(auth)/_layout.tsx" << 'EOF'
import { Slot } from 'expo-router';

export default function AuthLayout() {
  return <Slot />;
}
EOF

# Sign In Screen with Yup validation and a link to Sign Up
cat > "src/app/(auth)/sign-in.tsx" << 'EOF'
import React, { useState } from 'react';
import { View, Text, TextInput, Button } from 'react-native';
import * as Yup from 'yup';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/useAuthStore';

const signInSchema = Yup.object().shape({
  email: Yup.string().email('Please enter a valid email address.').required('Email is required.'),
  password: Yup.string().required('Password is required.'),
});

export default function SignInScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const { setUser } = useAuthStore();
  const router = useRouter();

  const handleSignIn = async () => {
    setErrorMessage('');
    try {
      await signInSchema.validate({ email, password }, { abortEarly: false });
    } catch (validationError) {
      if (validationError.inner) {
        const messages = validationError.inner.map(err => err.message).join('\n');
        setErrorMessage(messages);
      }
      return;
    }
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        setErrorMessage("Database error during sign in: " + error.message);
      } else if (data.session) {
        setUser(data.session.user);
      } else {
        setErrorMessage('No session returned. Please try again.');
      }
    } catch (err) {
      setErrorMessage('An error occurred during sign in: ' + err.message);
    }
  };

  return (
    <View style={{ flex: 1, padding: 16, justifyContent: 'center' }}>
      <Text style={{ fontSize: 24, marginBottom: 16 }}>Sign In</Text>
      <TextInput
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        style={{ borderWidth: 1, borderColor: '#ccc', marginBottom: 12, padding: 8 }}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <TextInput
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        style={{ borderWidth: 1, borderColor: '#ccc', marginBottom: 12, padding: 8 }}
        secureTextEntry
      />
      {errorMessage ? (
        <Text style={{ color: 'red', marginBottom: 12 }}>{errorMessage}</Text>
      ) : null}
      <Button title="Sign In" onPress={handleSignIn} />
      <Text style={{ marginTop: 16, color: 'blue' }} onPress={() => router.push('/sign-up')}>
        Don't have an account? Sign Up
      </Text>
    </View>
  );
}
EOF

# Sign Up Screen with Yup validation (including password strength) and robust error explanation
cat > "src/app/(auth)/sign-up.tsx" << 'EOF'
import React, { useState } from 'react';
import { View, Text, TextInput, Button } from 'react-native';
import * as Yup from 'yup';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/useAuthStore';

const signUpSchema = Yup.object().shape({
  email: Yup.string().email('Please enter a valid email address.').required('Email is required.'),
  password: Yup.string()
    .min(8, 'Password must be at least 8 characters long.')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).+$/, 'Password must contain uppercase, lowercase, number, and special character.')
    .required('Password is required.'),
});

export default function SignUpScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const { setUser } = useAuthStore();
  const router = useRouter();

  const handleSignUp = async () => {
    setErrorMessage('');
    try {
      await signUpSchema.validate({ email, password }, { abortEarly: false });
    } catch (validationError) {
      if (validationError.inner) {
        const messages = validationError.inner.map(err => err.message).join('\n');
        setErrorMessage(messages);
      }
      return;
    }
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });
      if (error) {
        // Provide a robust error message including suggestions for troubleshooting
        setErrorMessage(
          "Database error saving new user: " + error.message +
          ". This may be due to database constraints, misconfigured Supabase settings, or network issues. " +
          "Please verify your Supabase configuration and check your database logs for more details."
        );
      } else if (data.user) {
        setUser(data.user);
      } else {
        setErrorMessage('Sign up failed. Please try again.');
      }
    } catch (err) {
      setErrorMessage(
        "An unexpected error occurred during sign up: " + err.message +
        ". Please check your network connection and Supabase configuration."
      );
    }
  };

  return (
    <View style={{ flex: 1, padding: 16, justifyContent: 'center' }}>
      <Text style={{ fontSize: 24, marginBottom: 16 }}>Sign Up</Text>
      <TextInput
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        style={{ borderWidth: 1, borderColor: '#ccc', marginBottom: 12, padding: 8 }}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <TextInput
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        style={{ borderWidth: 1, borderColor: '#ccc', marginBottom: 12, padding: 8 }}
        secureTextEntry
      />
      {errorMessage ? (
        <Text style={{ color: 'red', marginBottom: 12 }}>{errorMessage}</Text>
      ) : null}
      <Button title="Sign Up" onPress={handleSignUp} />
      <Text style={{ marginTop: 16, color: 'blue' }} onPress={() => router.push('/sign-in')}>
        Already have an account? Sign In
      </Text>
    </View>
  );
}
EOF
#endregion

#region Scaffold Tab Screens Code
echo "📝 Generating code for Tab Screens..."

# Tab layout for tab navigation using expo-router
cat > "src/app/(tabs)/_layout.tsx" << 'EOF'
import { Tabs } from 'expo-router';

export default function TabLayout() {
  return (
    <Tabs>
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="create" options={{ title: 'Create' }} />
      <Tabs.Screen name="explore" options={{ title: 'Explore' }} />
      <Tabs.Screen name="groups" options={{ title: 'Groups' }} />
      <Tabs.Screen name="map" options={{ title: 'Map' }} />
      <Tabs.Screen name="messages" options={{ title: 'Messages' }} />
      <Tabs.Screen name="notifications" options={{ title: 'Notifications' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}
EOF

# Home Screen (index.tsx)
cat > "src/app/(tabs)/index.tsx" << 'EOF'
import { View, Text } from 'react-native';

export default function HomeScreen() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text>Welcome to the Home Screen</Text>
    </View>
  );
}
EOF

# Create Screen (create.tsx)
cat > "src/app/(tabs)/create.tsx" << 'EOF'
import { View, Text } from 'react-native';

export default function CreateScreen() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text>Create Screen</Text>
    </View>
  );
}
EOF

# Explore Screen (explore.tsx)
cat > "src/app/(tabs)/explore.tsx" << 'EOF'
import { View, Text } from 'react-native';

export default function ExploreScreen() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text>Explore Screen</Text>
    </View>
  );
}
EOF

# Groups Screen (groups.tsx)
cat > "src/app/(tabs)/groups.tsx" << 'EOF'
import { View, Text } from 'react-native';

export default function GroupsScreen() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text>Groups Screen</Text>
    </View>
  );
}
EOF

# Map Screen (map.tsx)
cat > "src/app/(tabs)/map.tsx" << 'EOF'
import { View, Text } from 'react-native';

export default function MapScreen() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text>Map Screen</Text>
    </View>
  );
}
EOF

# Messages Screen (messages.tsx)
cat > "src/app/(tabs)/messages.tsx" << 'EOF'
import { View, Text } from 'react-native';

export default function MessagesScreen() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text>Messages Screen</Text>
    </View>
  );
}
EOF

# Notifications Screen (notifications.tsx)
cat > "src/app/(tabs)/notifications.tsx" << 'EOF'
import { View, Text } from 'react-native';

export default function NotificationsScreen() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text>Notifications Screen</Text>
    </View>
  );
}
EOF

# Profile Screen (profile.tsx)
cat > "src/app/(tabs)/profile.tsx" << 'EOF'
import { View, Text } from 'react-native';

export default function ProfileScreen() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text>Profile Screen</Text>
    </View>
  );
}
EOF
#endregion

#region Supabase Client
echo "🗄  Creating Supabase client in src/lib/supabase.ts..."

cat > "src/lib/supabase.ts" << 'EOF'
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY environment variables.');
}

const detectSessionInUrl = Platform.OS === 'web';
const storage = Platform.OS === 'web' ? undefined : AsyncStorage;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: storage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: detectSessionInUrl,
  },
});
EOF
#endregion

#region Zustand Auth Store
echo "🛠️  Creating Zustand auth store in src/store/useAuthStore.ts..."

cat > "src/store/useAuthStore.ts" << 'EOF'
import { create } from 'zustand';
import { supabase } from '../lib/supabase';

type AuthState = {
  user: any;
  setUser: (user: any) => void;
  isLoading: boolean;
  setLoading: (loading: boolean) => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  setUser: (user) => set({ user }),
  isLoading: true,
  setLoading: (loading) => set({ isLoading: loading }),
}));

// Initialize auth session on app load
(async () => {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) {
    console.error('Error fetching session:', error);
  }
  useAuthStore.setState({
    user: session?.user || null,
    isLoading: false,
  });
})();

// Listen for auth state changes
supabase.auth.onAuthStateChange((event, session) => {
  useAuthStore.setState({
    user: session?.user || null,
    isLoading: false,
  });
});
EOF
#endregion

#region Configuration Files
echo "⚙️  Generating configuration files..."

# Babel configuration for NativeWind, Expo Router, and Reanimated
cat > babel.config.js << 'EOF'
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel"
    ],
    plugins: [
      "react-native-reanimated/plugin"
    ],
  };
};
EOF

# Metro configuration to integrate NativeWind with Expo
cat > metro.config.js << 'EOF'
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);
module.exports = withNativeWind(config, { input: "./global.css" });
EOF

# Tailwind configuration for NativeWind
cat > tailwind.config.js << 'EOF'
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./App.{js,jsx,ts,tsx}",
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}"
  ],
  theme: {
    extend: {},
  },
  presets: [require("nativewind/preset")],
  plugins: [],
}
EOF

# Create global.css for Tailwind styles
cat > global.css << 'EOF'
@tailwind base;
@tailwind components;
@tailwind utilities;
EOF
#endregion

#region Final Setup
echo "✅ Project setup complete!"
echo "Next steps:"
echo "1. Configure the Supabase client in src/lib/supabase.ts if needed."
echo "2. Verify and adjust the Zustand auth store in src/store/useAuthStore.ts as necessary."
echo "3. Update Tailwind and NativeWind configurations in tailwind.config.js if required."
echo "4. Add your environment variables to .env.local."
echo "5. Run and test the auth flow by signing in/up."
echo "   To test on the web, use: npx expo start --web"

# Start the Expo development server with a cache clear to ensure a fresh start
echo "🚀 Starting Expo development server..."
npx expo start --clear
#endregion
