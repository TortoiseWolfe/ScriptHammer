#!/usr/bin/env bash
set -eo pipefail

##############################################
# Expo Setup Script Template (TypeScript + NativeWind +
# Steampunk Themed Global CSS, Custom Button, Global Link,
# Input Shadow, Inverted Header/Tabs (with active tab color),
# and Geolocation Map with Platform-Specific Map Implementations)
##############################################

#region Metadata and Configuration
# -----------------------------------------------------------------------------
# Script Name:        expo-setup.sh
# Description:        Non-Interactive Expo setup script for initializing an
#                     Expo project using TypeScript with configuration for
#                     Supabase, Zustand, Tailwind + NativeWind, React Hook Form,
#                     Yup-based validation, and an Expo Router authentication flow.
#                     This version includes:
#                     - Web adjustments with a functional map on web using @react-google-maps/api
#                     - A Log Out button and Profile Edit screen
#                     - A fully functional dark/light theme toggle using a steampunk color scheme
#                     - A custom button component that uses a global ".btn" class defined in global CSS
#                     - Centralized link styling via a global ".link" class
#                     - A global input shadow class (.input-shadow) for form inputs
#                     - A centralized background utility class (.bg-steampunk-light) for screens
#                     - Inverted header and tabs styling in the tabs layout, with active tab color support
#                     - Renamed tab screens: "Messages" → "Chats" and "Notifications" → "Cues"
#                     - A Map tab that shows the user’s current geolocation (platform-specific implementations)
#                     - A nativewind-env.d.ts for proper TypeScript support.
#
# Author:             TurtleWolfe@ScriptHammer.com
# Created:            2025-02-08
# Version:            1.2.14
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
  echo "Please create one with at least the following content:"
  echo 'APP_NAME="ScriptHammer"'
  echo 'EXPO_PUBLIC_SUPABASE_URL="https://YOUR-PROJECT.supabase.co"'
  echo 'EXPO_PUBLIC_SUPABASE_ANON_KEY="YOUR-ANON-KEY"'
  echo 'EXPO_PUBLIC_GOOGLE_MAPS_API_KEY="YOUR_GOOGLE_MAPS_API_KEY"'
  exit 1
fi

required_vars=("APP_NAME" "EXPO_PUBLIC_SUPABASE_URL" "EXPO_PUBLIC_SUPABASE_ANON_KEY" "EXPO_PUBLIC_GOOGLE_MAPS_API_KEY")
for var in "${required_vars[@]}"; do
  if [ -z "${!var}" ]; then
    echo "ERROR: $var is not set in the .env file."
    exit 1
  fi
done
#endregion

#region Create Expo App (TypeScript)
echo "🚀 Creating Expo app: $APP_NAME"
npx create-expo-app "$APP_NAME"

echo "📂 Entering project directory"
cd "$APP_NAME" || { echo "ERROR: Failed to enter directory '$APP_NAME'"; exit 1; }

# Clean up default project files
echo "N" | npm run reset-project
rm -rf app-example
rm -f App.js App.tsx
#endregion

#region Check Local Expo CLI Installation
echo "🔍 Checking for Expo CLI in local dependencies..."
if ! npx expo --version >/dev/null 2>&1; then
  echo "Local Expo CLI not found. Installing expo-cli as a dev dependency..."
  npm install --save-dev expo-cli
  if ! npx expo --version >/dev/null 2>&1; then
    echo "ERROR: Local Expo CLI installation failed. Please check your npm setup."
    exit 1
  else
    echo "Local Expo CLI installed: $(npx expo --version)"
  fi
else
  echo "Local Expo CLI found: $(npx expo --version)"
fi
#endregion

#region Install Dependencies
echo "📦 Installing dependencies..."

# Core dependencies
core_deps=(
  "zustand"
  "@supabase/supabase-js@2"
  "@react-native-async-storage/async-storage"
  "react-native-url-polyfill"
  "react-hook-form"
  "yup"
)

# Expo dependencies
expo_deps=(
  "react-native-safe-area-context"
  "expo-status-bar"
)

# UI dependencies
ui_deps=(
  "nativewind"
)

# Web mapping dependency for interactive maps on web
web_deps=(
  "@react-google-maps/api"
)

# Dev dependencies
dev_deps=(
  "tailwindcss@3.3.2"
)

install_deps() {
  local arr=("$@")
  for dep in "${arr[@]}"; do
    npm install "$dep"
  done
}

echo "📦 Installing core dependencies..."
install_deps "${core_deps[@]}"
echo "📦 Installing Expo dependencies..."
install_deps "${expo_deps[@]}"
echo "🎨 Installing UI dependencies..."
install_deps "${ui_deps[@]}"
echo "🌐 Installing web mapping dependency..."
install_deps "${web_deps[@]}"
echo "🛠️ Installing dev dependencies..."
install_deps "${dev_deps[@]}"

# Install map dependencies (expo-location and react-native-maps) using local Expo CLI
echo "📦 Installing map dependencies..."
npx expo install expo-location react-native-maps
#endregion

#region CREATE DIRECTORY STRUCTURE
echo "📁 Creating directory structure..."

# Update directory structure: rename messages to chats and notifications to cues.
dir_structure=(
  ".env.local"
  "nativewind-env.d.ts"
  "src/lib/"
  "src/lib/supabase.ts"
  "src/store/"
  "src/store/useAuthStore.ts"
  "src/components/"
  "src/context/"
  "app/"
  "app/_layout.tsx"
  "app/error.tsx"
  "app/global.css"
  "app/loading.tsx"
  "app/not-found.tsx"
  "app/index.tsx"
  "app/(auth)/"
  "app/(auth)/_layout.tsx"
  "app/(auth)/signIn.tsx"
  "app/(auth)/signUp.tsx"
  "app/(tabs)/"
  "app/(tabs)/_layout.tsx"
  "app/(tabs)/home.tsx"
  "app/(tabs)/create.tsx"
  "app/(tabs)/explore.tsx"
  "app/(tabs)/groups.tsx"
  "app/(tabs)/map.tsx"
  "app/(tabs)/chats.tsx"
  "app/(tabs)/cues.tsx"
  "app/(tabs)/profile.tsx"
  "app/profileEdit.tsx"
)

for item in "${dir_structure[@]}"; do
  if [[ $item == */ ]]; then
    mkdir -p "$item"
  else
    mkdir -p "$(dirname "$item")"
    touch "$item"
  fi
done
#endregion

#region Create nativewind-env.d.ts
echo "📝 Generating TypeScript declaration for NativeWind at nativewind-env.d.ts..."
cat > "nativewind-env.d.ts" << 'EOF'
/// <reference types="nativewind/types" />
EOF
#endregion

#region Scaffold Global CSS with Steampunk Theme and Centralized Background Utility
echo "📝 Generating Global CSS at app/global.css..."
cat > "app/global.css" << 'EOF'
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --bg-light: #f0e6d2; /* Warm beige */
  --text-light: #3b302a; /* Dark brown */
  --bg-dark: #3c2e2b;   /* Dark rusty */
  --text-dark: #d4bfa3; /* Light copper */
  --text-active: #5a4a42; /* Dark metal for active elements */
}

/* Steampunk Light Theme */
html, body {
  background-color: var(--bg-light);
  color: var(--text-light);
}

/* Steampunk Dark Theme */
.dark html, .dark body {
  background-color: var(--bg-dark);
  color: var(--text-dark);
}

/* Centralized background utility for screens */
.bg-steampunk-light {
  background-color: var(--bg-light);
}
.dark .bg-steampunk-light {
  background-color: var(--bg-dark);
}

/* Global button class with steampunk styling */
.btn {
  @apply px-4 py-2 rounded-lg font-medium;
  /* Light theme - Brass/Copper colors */
  @apply bg-[#c0a080] text-[#3b302a] border-2 border-[#3b302a];
  /* Dark theme - Dark metal colors */
  @apply dark:bg-[#5a4a42] dark:text-[#d4bfa3] dark:border-[#d4bfa3];
  @apply active:opacity-80 active:scale-95 transition-all;
}

/* Global link styling */
.link {
  @apply underline;
  color: var(--text-light);
}
.dark .link {
  color: var(--text-dark);
}

/* Global input styling with inset drop shadow */
.input-shadow {
  -webkit-box-shadow: inset -8px -10px 39px 5px rgba(0,0,0,0.75);
  -moz-box-shadow: inset -8px -10px 39px 5px rgba(0,0,0,0.75);
  box-shadow: inset -8px -10px 39px 5px rgba(0,0,0,0.75);
}
EOF
#endregion

#region Scaffold Tailwind Config
echo "📝 Generating Tailwind configuration at tailwind.config.js..."
cat > "tailwind.config.js" << 'EOF'
/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    "./App.{js,jsx,ts,tsx}",
    "./app/**/*.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        light: {
          primary: '#c0a080',
          secondary: '#3b302a',
        },
        dark: {
          primary: '#5a4a42',
          secondary: '#d4bfa3',
        },
      },
    },
  },
  presets: [require("nativewind/preset")],
  plugins: [],
}
EOF
#endregion

#region Scaffold Metro Config with Custom Resolver for Maps on Web
echo "📝 Generating Metro configuration at metro.config.js..."
cat > "metro.config.js" << 'EOF'
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// Add custom resolver for react-native-maps on web
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'react-native-maps' && platform === 'web') {
    return {
      filePath: './src/components/MapViewWrapper.web.tsx',
      type: 'sourceFile',
    };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativeWind(config, { input: "./app/global.css" });
EOF
#endregion

#region Scaffold Babel Config
echo "📝 Generating Babel configuration at babel.config.js..."
cat > "babel.config.js" << 'EOF'
module.exports = function(api) {
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
#endregion

#region Scaffold Custom Button Component with Global CSS Usage
echo "📝 Generating Custom Button component at src/components/CustomButton.tsx..."
cat > "src/components/CustomButton.tsx" << 'EOF'
import React from 'react';
import { TouchableOpacity, Text } from 'react-native';
// Global CSS is imported in the layouts so styles are applied globally.

// CustomButton component using the global ".btn" class defined in global.css
interface CustomButtonProps {
  title: string;
  onPress: () => void;
}

export function CustomButton({ title, onPress }: CustomButtonProps) {
  // Use the global "btn" class defined in global.css for theming.
  return (
    <TouchableOpacity onPress={onPress} className="btn">
      <Text className="font-bold text-center">{title}</Text>
    </TouchableOpacity>
  );
}
EOF
#endregion

#region Scaffold Platform-Specific MapViewWrapper Components
echo "📝 Generating MapViewWrapper.native.tsx for native platforms at src/components/MapViewWrapper.native.tsx..."
cat > "src/components/MapViewWrapper.native.tsx" << 'EOF'
import MapView from 'react-native-maps';

// MapViewWrapper for native (iOS/Android)
export default function MapViewWrapper(props: any) {
  return <MapView {...props} />;
}

// Marker for native platforms using react-native-maps
export function Marker(props: any) {
  return <MapView.Marker {...props} />;
}
EOF

echo "📝 Generating MapViewWrapper.web.tsx for web at src/components/MapViewWrapper.web.tsx..."
cat > "src/components/MapViewWrapper.web.tsx" << 'EOF'
import React from 'react';
import { GoogleMap, LoadScript, Marker as GMarker } from '@react-google-maps/api';

// MapViewWrapper for web using Google Maps API
export default function MapViewWrapper(props: any) {
  return (
    <LoadScript googleMapsApiKey={process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || ''}>
      <GoogleMap
        mapContainerStyle={{ width: '100%', height: '100%' }}
        center={{
          lat: props.initialRegion?.latitude || 0,
          lng: props.initialRegion?.longitude || 0,
        }}
        zoom={15}
      >
        {props.children}
      </GoogleMap>
    </LoadScript>
  );
}

// Marker component for web using Google Maps API
export function Marker(props: any) {
  return <GMarker position={{ lat: props.coordinate.latitude, lng: props.coordinate.longitude }} />;
}
EOF
#endregion

#region Scaffold Theme Context
echo "📝 Generating Theme Context at src/context/ThemeContext.tsx..."
cat > "src/context/ThemeContext.tsx" << 'EOF'
import React, { createContext, useContext, useState, useEffect } from 'react';
import { Appearance, Platform } from 'react-native';

// Create a ThemeContext for dark/light mode
const ThemeContext = createContext<{ theme: string; toggleTheme: () => void } | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemColorScheme = Appearance.getColorScheme() || 'light';
  const [theme, setTheme] = useState(systemColorScheme);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  useEffect(() => {
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      setTheme(colorScheme || 'light');
    });
    return () => subscription.remove();
  }, []);

  // For web, update the root element's class list
  if (Platform.OS === 'web') {
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within a ThemeProvider");
  return context;
}
EOF
#endregion

#region Scaffold Root Layout (Wrap with ThemeProvider and Import Global CSS)
echo "📝 Generating Root Layout at app/_layout.tsx..."
cat > "app/_layout.tsx" << 'EOF'
import React, { useEffect } from 'react';
import { useRouter, usePathname, Slot } from 'expo-router';
import { useAuthStore } from '../src/store/useAuthStore';
import { ActivityIndicator, View } from 'react-native';
import { ThemeProvider } from '../src/context/ThemeContext';
import "./global.css";

// RootLayout wraps the app with ThemeProvider and handles authentication redirection.
export default function RootLayout() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isLoading } = useAuthStore();

  useEffect(() => {
    if (isLoading) return;
    if (!user && pathname && !pathname.startsWith('/signIn') && !pathname.startsWith('/signUp')) {
      router.replace('/signIn');
    }
    if (user && pathname && (pathname.startsWith('/signIn') || pathname.startsWith('/signUp'))) {
      router.replace('/home');
    }
  }, [user, isLoading, pathname, router]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <ThemeProvider>
      <Slot />
    </ThemeProvider>
  );
}
EOF
#endregion

#region Scaffold Auth Layout (Import Global CSS)
echo "📝 Generating Auth Layout at app/(auth)/_layout.tsx..."
cat > "app/(auth)/_layout.tsx" << 'EOF'
import { Slot } from 'expo-router';
import "../global.css";

// AuthLayout simply renders its child screens.
export default function AuthLayout() {
  return <Slot />;
}
EOF
#endregion

#region Scaffold Tabs Layout with Active Tab Colors
echo "📝 Generating Tabs Layout at app/(tabs)/_layout.tsx..."
cat > "app/(tabs)/_layout.tsx" << 'EOF'
import { Tabs } from 'expo-router';
import { useTheme } from '../../src/context/ThemeContext';
import "../global.css";

// TabLayout inverts header and tab bar styling based on the current theme
// and applies active/inactive tint colors based on global CSS variables.
export default function TabLayout() {
  const { theme } = useTheme();
  // Invert background color for header/tab bar relative to the body:
  const headerBackground = theme === 'light' ? 'var(--bg-dark)' : 'var(--bg-light)';
  // Inactive text color uses the standard text color:
  const inactiveColor = theme === 'light' ? 'var(--text-dark)' : 'var(--text-light)';
  // Active tab text color uses the custom active color defined in global CSS:
  const activeColor = 'var(--text-active)';

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: headerBackground },
        headerTintColor: inactiveColor,
        tabBarStyle: { backgroundColor: headerBackground },
        tabBarActiveTintColor: activeColor,
        tabBarInactiveTintColor: inactiveColor,
      }}
    >
      <Tabs.Screen name="home" options={{ title: 'Home' }} />
      <Tabs.Screen name="create" options={{ title: 'Create' }} />
      <Tabs.Screen name="explore" options={{ title: 'Explore' }} />
      <Tabs.Screen name="groups" options={{ title: 'Groups' }} />
      <Tabs.Screen name="map" options={{ title: 'Map' }} />
      <Tabs.Screen name="chats" options={{ title: 'Chats' }} />
      <Tabs.Screen name="cues" options={{ title: 'Cues' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}
EOF
#endregion

#region Scaffold Root Index Screen (Redirect to Home)
echo "📝 Generating Root Index Screen at app/index.tsx..."
cat > "app/index.tsx" << 'EOF'
import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';

// Index screen redirects immediately to /home once the app is mounted.
export default function Index() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted) {
      router.replace('/home');
    }
  }, [mounted, router]);

  return null;
}
EOF
#endregion

#region Scaffold Additional Screens (Error, Loading, Not Found)
echo "📝 Generating Error, Loading, and Not Found screens..."

cat > "app/error.tsx" << 'EOF'
import React from 'react';
import { View, Text } from 'react-native';

// ErrorScreen is displayed when an error occurs.
export default function ErrorScreen() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text>An error occurred.</Text>
    </View>
  );
}
EOF

cat > "app/loading.tsx" << 'EOF'
import React from 'react';
import { View, ActivityIndicator } from 'react-native';

// LoadingScreen is displayed while the app is loading.
export default function LoadingScreen() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator size="large" />
    </View>
  );
}
EOF

cat > "app/not-found.tsx" << 'EOF'
import React from 'react';
import { View, Text } from 'react-native';

// NotFoundScreen is displayed for unmatched routes.
export default function NotFoundScreen() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text>Page not found.</Text>
    </View>
  );
}
EOF
#endregion

#region Scaffold Auth Screens Code
echo "📝 Generating Auth Screens..."

cat > "app/(auth)/signIn.tsx" << 'EOF'
import React, { useState } from 'react';
import { View, Text, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import * as Yup from 'yup';
import { supabase } from '../../src/lib/supabase';
import { useAuthStore } from '../../src/store/useAuthStore';
import { CustomButton } from '../../src/components/CustomButton';

// Validation schema for sign in
const signInSchema = Yup.object().shape({
  email: Yup.string().email('Please enter a valid email address.').required('Email is required.'),
  password: Yup.string().required('Password is required.'),
});

export default function SignInScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const { setUser } = useAuthStore();
  const router = useRouter();

  const handleSignIn = async () => {
    setErrors({});
    setServerError('');
    try {
      await signInSchema.validate({ email, password }, { abortEarly: false });
    } catch (validationError) {
      if (validationError.inner) {
        const newErrors = {};
        validationError.inner.forEach((err: any) => {
          if (err.path) newErrors[err.path] = err.message;
        });
        setErrors(newErrors);
      }
      return;
    }
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setServerError(error.message);
      } else if (data.session) {
        setUser(data.session.user);
      } else {
        setServerError('No session returned. Please try again.');
      }
    } catch (err) {
      setServerError('An error occurred during sign in. Please try again later.');
    }
  };

  return (
    <View style={{ flex: 1, padding: 16, justifyContent: 'center' }}>
      <Text style={{ fontSize: 24, marginBottom: 16 }}>Sign In</Text>
      <View style={{ marginBottom: 12 }}>
        <TextInput
          placeholder="Email"
          value={email}
          onChangeText={(text) => {
            setEmail(text);
            if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
          }}
          style={{ borderWidth: 1, borderColor: errors.email ? 'red' : '#ccc', padding: 8, borderRadius: 4 }}
          autoCapitalize="none"
          keyboardType="email-address"
          className="input-shadow"
        />
        {errors.email && <Text style={{ color: 'red', marginTop: 4 }}>{errors.email}</Text>}
      </View>
      <View style={{ marginBottom: 12 }}>
        <TextInput
          placeholder="Password"
          value={password}
          onChangeText={(text) => {
            setPassword(text);
            if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
          }}
          style={{ borderWidth: 1, borderColor: errors.password ? 'red' : '#ccc', padding: 8, borderRadius: 4 }}
          secureTextEntry
          className="input-shadow"
        />
        {errors.password && <Text style={{ color: 'red', marginTop: 4 }}>{errors.password}</Text>}
      </View>
      {serverError && <Text style={{ color: 'red', marginBottom: 12 }}>{serverError}</Text>}
      <CustomButton title="Sign In" onPress={handleSignIn} />
      <Text onPress={() => router.push('/signUp')} className="link mt-4 text-center">
        Don't have an account? Sign Up
      </Text>
    </View>
  );
}
EOF

# Sign Up Screen
cat > "app/(auth)/signUp.tsx" << 'EOF'
import React, { useState } from 'react';
import { View, Text, TextInput } from 'react-native';
import * as Yup from 'yup';
import { supabase } from '../../src/lib/supabase';
import { useAuthStore } from '../../src/store/useAuthStore';
import { CustomButton } from '../../src/components/CustomButton';

// Validation schema for sign up
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
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const { setUser } = useAuthStore();

  const handleSignUp = async () => {
    setErrors({});
    setServerError('');
    try {
      await signUpSchema.validate({ email, password }, { abortEarly: false });
    } catch (validationError) {
      if (validationError.inner) {
        const newErrors = {};
        validationError.inner.forEach((err: any) => {
          if (err.path) newErrors[err.path] = err.message;
        });
        setErrors(newErrors);
      }
      return;
    }
    try {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setServerError(error.message);
      } else if (data.user) {
        setUser(data.user);
      } else {
        setServerError('Sign up failed. Please try again.');
      }
    } catch (err) {
      setServerError('An error occurred during sign up. Please try again later.');
    }
  };

  return (
    <View style={{ flex: 1, padding: 16, justifyContent: 'center' }}>
      <Text style={{ fontSize: 24, marginBottom: 16 }}>Sign Up</Text>
      <View style={{ marginBottom: 12 }}>
        <TextInput
          placeholder="Email"
          value={email}
          onChangeText={(text) => {
            setEmail(text);
            if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
          }}
          style={{ borderWidth: 1, borderColor: errors.email ? 'red' : '#ccc', padding: 8, borderRadius: 4 }}
          autoCapitalize="none"
          keyboardType="email-address"
          className="input-shadow"
        />
        {errors.email && <Text style={{ color: 'red', marginTop: 4 }}>{errors.email}</Text>}
      </View>
      <View style={{ marginBottom: 12 }}>
        <TextInput
          placeholder="Password"
          value={password}
          onChangeText={(text) => {
            setPassword(text);
            if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
          }}
          style={{ borderWidth: 1, borderColor: errors.password ? 'red' : '#ccc', padding: 8, borderRadius: 4 }}
          secureTextEntry
          className="input-shadow"
        />
        {errors.password && <Text style={{ color: 'red', marginTop: 4 }}>{errors.password}</Text>}
      </View>
      {serverError && <Text style={{ color: 'red', marginBottom: 12 }}>{serverError}</Text>}
      <CustomButton title="Sign Up" onPress={handleSignUp} />
    </View>
  );
}
EOF
#endregion

#region Scaffold Tab Screens Code
echo "📝 Generating code for Tab Screens..."

# Home Screen – use centralized background utility
cat > "app/(tabs)/home.tsx" << 'EOF'
import React from 'react';
import { View, Text } from 'react-native';

// Home screen using centralized background utility
export default function HomeScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-steampunk-light">
      <Text className="text-[#3b302a] dark:text-[#d4bfa3] text-lg font-bold">
        Welcome to the Home Screen
      </Text>
    </View>
  );
}
EOF

# Create Screen
cat > "app/(tabs)/create.tsx" << 'EOF'
import React from 'react';
import { View, Text } from 'react-native';
import { CustomButton } from '../../src/components/CustomButton';

// Create screen with a sample action button
export default function CreateScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-steampunk-light">
      <Text className="text-[#3b302a] dark:text-[#d4bfa3] mb-4">Create Screen</Text>
      <CustomButton title="Action" onPress={() => {}} />
    </View>
  );
}
EOF

# Explore Screen
cat > "app/(tabs)/explore.tsx" << 'EOF'
import React from 'react';
import { View, Text } from 'react-native';

// Explore screen
export default function ExploreScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-steampunk-light">
      <Text className="text-[#3b302a] dark:text-[#d4bfa3]">Explore Screen</Text>
    </View>
  );
}
EOF

# Groups Screen
cat > "app/(tabs)/groups.tsx" << 'EOF'
import React from 'react';
import { View, Text } from 'react-native';

// Groups screen
export default function GroupsScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-steampunk-light">
      <Text className="text-[#3b302a] dark:text-[#d4bfa3]">Groups Screen</Text>
    </View>
  );
}
EOF

# Map Screen with Geolocation using expo-location and react-native-maps
cat > "app/(tabs)/map.tsx" << 'EOF'
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
// Import MapView and Marker from our platform-specific implementation.
import MapView, { Marker } from '../../src/components/MapViewWrapper';
import * as Location from 'expo-location';

export default function MapScreen() {
  const [location, setLocation] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      // Request location permissions
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrorMsg('Permission to access location was denied');
        return;
      }
      // Fetch current location
      let currentLocation = await Location.getCurrentPositionAsync({});
      setLocation(currentLocation);
    })();
  }, []);

  if (errorMsg) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>{errorMsg}</Text>
      </View>
    );
  }

  if (!location) {
    return (
      <View style={styles.container}>
        <Text style={styles.infoText}>Fetching location...</Text>
      </View>
    );
  }

  const { latitude, longitude } = location.coords;
  return (
    <MapView
      style={styles.map}
      initialRegion={{
        latitude,
        longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }}
    >
      <Marker coordinate={{ latitude, longitude }} title="You are here" />
    </MapView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0e6d2', // Steampunk light background (matches global theme)
    alignItems: 'center',
    justifyContent: 'center',
  },
  map: {
    flex: 1,
  },
  errorText: {
    color: 'red',
    fontSize: 16,
  },
  infoText: {
    color: '#3b302a',
    fontSize: 16,
  },
});
EOF

# Chats Screen (formerly "Messages")
cat > "app/(tabs)/chats.tsx" << 'EOF'
import { View, Text } from 'react-native';

export default function ChatsScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-steampunk-light">
      <Text className="text-[#3b302a] dark:text-[#d4bfa3]">Chats</Text>
    </View>
  );
}
EOF

# Cues Screen (formerly "Notifications")
cat > "app/(tabs)/cues.tsx" << 'EOF'
import React from 'react';
import { View, Text } from 'react-native';

// Cues screen (formerly "Notifications")
export default function CuesScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-steampunk-light">
      <Text className="text-[#3b302a] dark:text-[#d4bfa3]">Cues</Text>
    </View>
  );
}
EOF

# Profile Screen with Log Out, Edit Profile, and Theme Toggle using CustomButton and Link styling
cat > "app/(tabs)/profile.tsx" << 'EOF'
import React from 'react';
import { View, Text } from 'react-native';
import { supabase } from '../../src/lib/supabase';
import { useAuthStore } from '../../src/store/useAuthStore';
import { useRouter } from 'expo-router';
import { useTheme } from '../../src/context/ThemeContext';
import { CustomButton } from '../../src/components/CustomButton';

// Profile screen with Log Out, Edit Profile, and theme toggle
export default function ProfileScreen() {
  const { setUser, user } = useAuthStore();
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (!error) {
      setUser(null);
      router.replace('/signIn');
    } else {
      console.error("Error signing out:", error);
    }
  };

  return (
    <View className="flex-1 items-center justify-center bg-steampunk-light p-4">
      <Text className="text-[#3b302a] dark:text-[#d4bfa3] text-2xl mb-4">Profile</Text>
      {user && (
        <>
          <Text className="text-[#3b302a] dark:text-[#d4bfa3] mb-2">Email: {user.email}</Text>
        </>
      )}
      <CustomButton title="Log Out" onPress={handleLogout} />
      <Text onPress={() => router.push('/profileEdit')} className="link mt-4 text-center">
        Edit Profile
      </Text>
      <CustomButton title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`} onPress={toggleTheme} />
    </View>
  );
}
EOF
#endregion

#region Scaffold Profile Edit Screen (Outside Tabs)
echo "📝 Generating Profile Edit Screen at app/profileEdit.tsx..."
cat > "app/profileEdit.tsx" << 'EOF'
import React, { useState, useEffect } from 'react';
import { View, Text, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../src/lib/supabase';
import { useAuthStore } from '../src/store/useAuthStore';
import { CustomButton } from '../src/components/CustomButton';

// ProfileEditScreen allows the user to edit their profile details.
export default function ProfileEditScreen() {
  const { user, setUser } = useAuthStore();
  const [avatar, setAvatar] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();

  useEffect(() => {
    async function fetchProfile() {
      if (user) {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        if (error) {
          console.error('Error fetching profile:', error);
        } else if (data) {
          setAvatar(data.avatar || '');
          setDisplayName(data.displayName || '');
          setBio(data.bio || '');
        }
      }
    }
    fetchProfile();
  }, [user]);

  const handleSave = async () => {
    setError('');
    const updates = {
      avatar,
      displayName,
      bio,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase
      .from('profiles')
      .upsert({ id: user.id, ...updates }, { returning: 'minimal' });
    if (error) {
      setError(error.message);
    } else {
      router.back();
    }
  };

  return (
    <View className="flex-1 p-4 bg-steampunk-light">
      <Text className="text-2xl mb-4 text-[#3b302a] dark:text-[#d4bfa3]">Edit Profile</Text>
      {error && <Text className="text-red-500 mb-3">{error}</Text>}
      <Text className="text-[#3b302a] dark:text-[#d4bfa3] mb-1">Avatar URL:</Text>
      <TextInput value={avatar} onChangeText={setAvatar} className="border border-gray-300 p-2 rounded mb-3 input-shadow" />
      <Text className="text-[#3b302a] dark:text-[#d4bfa3] mb-1">Display Name:</Text>
      <TextInput value={displayName} onChangeText={setDisplayName} className="border border-gray-300 p-2 rounded mb-3 input-shadow" />
      <Text className="text-[#3b302a] dark:text-[#d4bfa3] mb-1">Bio:</Text>
      <TextInput value={bio} onChangeText={setBio} className="border border-gray-300 p-2 rounded mb-3 input-shadow" />
      <CustomButton title="Save" onPress={handleSave} />
      <CustomButton title="Cancel" onPress={() => router.back()} />
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

// Initialize Supabase client using environment variables
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
// Define the authentication state type

// Define the authentication state type
type AuthState = {
  user: any;
  setUser: (user: any) => void;
  isLoading: boolean;
  setLoading: (loading: boolean) => void;
};

// Create Zustand store for authentication
export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  setUser: (user) => set({ user }),
  isLoading: true,
  setLoading: (loading) => set({ isLoading: loading }),
}));

// Immediately fetch session on load
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

#region Final Setup
echo "✅ Project setup complete!"
echo "Next steps:"
echo "1. Ensure your .env file uses the prefix 'EXPO_PUBLIC_GOOGLE_MAPS_API_KEY' for the Google Maps API key."
echo "2. Adjust the Supabase client in src/lib/supabase.ts if needed."
echo "3. Verify the Zustand auth store in src/store/useAuthStore.ts."
echo "4. Update Tailwind and NativeWind configurations in tailwind.config.js if required."
echo "5. Run and test the auth flow by signing in/up. For web, use: npx expo start --clear"
echo "🚀 Starting Expo development server..."
npx expo start --clear
#endregion
