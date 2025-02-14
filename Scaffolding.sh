#!/usr/bin/env bash
set -eo pipefail

##############################################
# Expo Setup Script Template with Combined Create/Edit Post Draft,
# Home Screen, Realtime UI, Inline Error Handling, and Updated CommentsSection Styling.
#
# NOTE:
#  - Run your backend SQL scripts (Schema Initialization & Seed Data)
#    separately in your Supabase SQL editor.
#  - This script assumes backend tables/views are named:
#      profiles, posts, conversations, messages, and users (view).
##############################################

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

# Define production dependencies (installed via Expo CLI)
prod_deps=(
  "zustand"
  "@supabase/supabase-js@2"
  "@react-native-async-storage/async-storage"
  "react-native-url-polyfill"
  "react-hook-form"
  "yup"
  "react-native-safe-area-context"
  "expo-status-bar"
  "nativewind"
  "react-native-picker-select"
  "@react-google-maps/api"
  "expo-location"
  "react-native-maps"
)

# Define dev dependencies (installed via npm)
dev_deps=( "tailwindcss@3.3.2" )

echo "Installing production dependencies with Expo CLI..."
npx expo install "${prod_deps[@]}"

echo "Installing dev dependencies using npm..."
npm install --save-dev "${dev_deps[@]}"
#endregion

#region Create Directory Structure
echo "📁 Creating directory structure..."
dir_structure=(
  ".env.local"
  "nativewind-env.d.ts"
  "src/lib/"
  "src/lib/supabase.ts"
  "src/store/"
  "src/store/useAuthStore.ts"
  "src/components/"
  "src/context/"
  "src/utils/"
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
  "src/components/ChatMessage.tsx"
  "src/components/MessageInput.tsx"
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
cat > "nativewind-env.d.ts" << 'EOF'
/// <reference types="nativewind/types" />
EOF
#endregion

#region Scaffold Global CSS
cat > "app/global.css" << 'EOF'
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --bg-light: #f0e6d2;
  --text-light: #3b302a;
  --bg-dark: #3c2e2b;
  --text-dark: #d4bfa3;
  --text-active: #5a4a42;
}

html, body {
  background-color: var(--bg-light);
  color: var(--text-light);
}

.dark html, .dark body {
  background-color: var(--bg-dark);
  color: var(--text-dark);
}

.bg-steampunk-light {
  background-color: var(--bg-light);
}
.dark .bg-steampunk-light {
  background-color: var(--bg-dark);
}

.btn {
  @apply px-4 py-2 rounded-lg font-medium;
  @apply bg-[#c0a080] text-[#3b302a] border-2 border-[#3b302a];
  @apply dark:bg-[#5a4a42] dark:text-[#d4bfa3] dark:border-[#d4bfa3];
  @apply active:opacity-80 active:scale-95 transition-all;
}

.link {
  @apply underline;
  color: var(--text-light);
}
.dark .link {
  color: var(--text-dark);
}

.input-shadow {
  -webkit-box-shadow: inset -8px -10px 39px 5px rgba(0,0,0,0.75);
  -moz-box-shadow: inset -8px -10px 39px 5px rgba(0,0,0,0.75);
  box-shadow: inset -8px -10px 39px 5px rgba(0,0,0,0.75);
}

/* Updated comment meta styles with increased specificity */
html body .comment-meta {
  color: #4B5563 !important;  /* Tailwind gray-600 */
  font-size: 0.75rem !important; /* text-xs */
}
.dark html body .comment-meta {
  color: #D1D5DB !important;  /* Tailwind gray-300 */
}
EOF
#endregion

#region Scaffold Tailwind Config
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

#region Scaffold Metro Config
cat > "metro.config.js" << 'EOF'
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

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

#region Scaffold Custom Button Component
cat > "src/components/CustomButton.tsx" << 'EOF'
import React from 'react';
import { TouchableOpacity, Text } from 'react-native';

interface CustomButtonProps {
  title: string;
  onPress: () => void;
}

export function CustomButton({ title, onPress }: CustomButtonProps) {
  return (
    <TouchableOpacity onPress={onPress} className="btn">
      <Text className="text-center">{title}</Text>
    </TouchableOpacity>
  );
}
EOF
#endregion

#region Scaffold MapViewWrapper Components
cat > "src/components/MapViewWrapper.native.tsx" << 'EOF'
import MapView from 'react-native-maps';

export default function MapViewWrapper(props: any) {
  return <MapView {...props} />;
}

export function Marker(props: any) {
  return <MapView.Marker {...props} />;
}
EOF

cat > "src/components/MapViewWrapper.web.tsx" << 'EOF'
import React from 'react';
import { GoogleMap, LoadScript, Marker as GMarker } from '@react-google-maps/api';

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

export function Marker(props: any) {
  return <GMarker position={{ lat: props.coordinate.latitude, lng: props.coordinate.longitude }} />;
}
EOF
#endregion

#region Scaffold Theme Context
cat > "src/context/ThemeContext.tsx" << 'EOF'
import React, { createContext, useContext, useState, useEffect } from 'react';
import { Appearance, Platform } from 'react-native';

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

#region Scaffold Root Layout
cat > "app/_layout.tsx" << 'EOF'
import React, { useEffect } from 'react';
import { useRouter, usePathname, Slot } from 'expo-router';
import { useAuthStore } from '../src/store/useAuthStore';
import { ActivityIndicator, View } from 'react-native';
import { ThemeProvider } from '../src/context/ThemeContext';
import "./global.css";

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

#region Scaffold Auth Layout
cat > "app/(auth)/_layout.tsx" << 'EOF'
import { Slot } from 'expo-router';
import "../global.css";

export default function AuthLayout() {
  return <Slot />;
}
EOF
#endregion

#region Scaffold Tabs Layout
cat > "app/(tabs)/_layout.tsx" << 'EOF'
import React from 'react';
import { Tabs } from 'expo-router';
import { useTheme } from '../../src/context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import "../global.css";

export default function TabLayout() {
  const { theme } = useTheme();
  const headerBackground = theme === 'light' ? 'var(--bg-dark)' : 'var(--bg-light)';
  const headerText = theme === 'light' ? 'var(--text-dark)' : 'var(--text-light)';
  const inactiveColor = theme === 'light' ? 'var(--text-dark)' : 'var(--text-light)';
  const activeColor = 'var(--text-active)';

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: headerBackground },
        headerTintColor: headerText,
        tabBarStyle: { backgroundColor: headerBackground },
        tabBarActiveTintColor: activeColor,
        tabBarInactiveTintColor: inactiveColor,
      }}
    >
      <Tabs.Screen 
        name="home" 
        options={{ 
          title: 'Home',
          tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" color={color} size={size} />,
        }} 
      />
      <Tabs.Screen 
        name="create" 
        options={{ 
          title: 'Create',
          tabBarIcon: ({ color, size }) => <Ionicons name="add-circle-outline" color={color} size={size} />,
        }} 
      />
      <Tabs.Screen 
        name="explore" 
        options={{ 
          title: 'Explore',
          tabBarIcon: ({ color, size }) => <Ionicons name="compass-outline" color={color} size={size} />,
        }} 
      />
      <Tabs.Screen 
        name="groups" 
        options={{ 
          title: 'Groups',
          tabBarIcon: ({ color, size }) => <Ionicons name="people-outline" color={color} size={size} />,
        }} 
      />
      <Tabs.Screen 
        name="map" 
        options={{ 
          title: 'Map',
          tabBarIcon: ({ color, size }) => <Ionicons name="location-outline" color={color} size={size} />,
        }} 
      />
      <Tabs.Screen 
        name="chats" 
        options={{ 
          title: 'Chats',
          tabBarIcon: ({ color, size }) => <Ionicons name="chatbubble-ellipses-outline" color={color} size={size} />,
        }} 
      />
      <Tabs.Screen 
        name="cues" 
        options={{ 
          title: 'Cues',
          tabBarIcon: ({ color, size }) => <Ionicons name="notifications-outline" color={color} size={size} />,
        }} 
      />
      <Tabs.Screen 
        name="profile" 
        options={{ 
          title: 'Profile',
          tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" color={color} size={size} />,
        }} 
      />
    </Tabs>
  );
}
EOF
#endregion

#region Scaffold Root Index Screen
cat > "app/index.tsx" << 'EOF'
import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';

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

#region Scaffold Additional Screens
cat > "app/error.tsx" << 'EOF'
import React from 'react';
import { View, Text } from 'react-native';

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

export default function NotFoundScreen() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text>Page not found.</Text>
    </View>
  );
}
EOF
#endregion

#region Scaffold Auth Screens
cat > "app/(auth)/signIn.tsx" << 'EOF'
import React, { useState } from 'react';
import { View, Text, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import * as Yup from 'yup';
import { supabase } from '../../src/lib/supabase';
import { useAuthStore } from '../../src/store/useAuthStore';
import { CustomButton } from '../../src/components/CustomButton';

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

cat > "app/(auth)/signUp.tsx" << 'EOF'
import React, { useState } from 'react';
import { View, Text, TextInput } from 'react-native';
import * as Yup from 'yup';
import { supabase } from '../../src/lib/supabase';
import { useAuthStore } from '../../src/store/useAuthStore';
import { CustomButton } from '../../src/components/CustomButton';

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

#region Scaffold Utils - Supabase Helpers
cat > "src/utils/supabaseHelpers.ts" << 'EOF'
import { supabase } from '../lib/supabase';

/**
 * Fetches the profile for a given post if the displayName is missing.
 * This helper ensures that the post object has the joined profile data.
 */
export async function fetchProfileForPost(post: any): Promise<any> {
  if (!post.profiles || !post.profiles.displayName) {
    const { data: profileData, error } = await supabase
      .from('profiles')
      .select('displayName')
      .eq('id', post.user_id)
      .maybeSingle();
    if (!error && profileData) {
      post.profiles = profileData;
    }
  }
  return post;
}
EOF
#endregion

#region Scaffold CommentsSection Component
cat > "src/components/CommentsSection.tsx" << 'EOF'
import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity } from 'react-native';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';
import { CustomButton } from './CustomButton';

interface Comment {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  parent_comment_id?: string | null;
  profiles?: { displayName: string };
}

interface CommentsSectionProps {
  postId: string;
}

export function CommentsSection({ postId }: CommentsSectionProps) {
  const { user } = useAuthStore();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const fetchComments = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('comments')
        .select('*, profiles!inner(displayName)')
        .eq('post_id', postId)
        .order('created_at', { ascending: true });
      if (error) {
        console.error('Error fetching comments:', error);
      } else {
        setComments(data as Comment[]);
      }
    } catch (err) {
      console.error('Unexpected error fetching comments:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComments();
  }, [postId]);

  const handleSubmitComment = async () => {
    if (!newComment.trim()) return;
    try {
      const payload = {
        post_id: postId,
        user_id: user.id,
        content: newComment,
        parent_comment_id: replyTo ? replyTo.id : null,
      };
      const { error } = await supabase.from('comments').insert([payload]).single();
      if (error) {
        console.error('Error submitting comment:', error);
      } else {
        setNewComment('');
        setReplyTo(null);
        fetchComments();
      }
    } catch (err) {
      console.error('Unexpected error submitting comment:', err);
    }
  };

  const renderCommentItem = (comment: Comment, level: number = 0) => {
    return (
      <View key={comment.id} style={{ marginLeft: level * 16 }} className="mt-1">
        {/* Render comment content first */}
        <Text className="text-base text-[#3b302a] dark:text-[#d4bfa3]">
          {comment.content}
        </Text>
        {/* Render meta information (author's name and timestamp) below content */}
        <Text className="comment-meta">
          {comment.profiles?.displayName || 'Unknown'} • {new Date(comment.created_at).toLocaleString()}
        </Text>
        {user && (
          <TouchableOpacity onPress={() => setReplyTo(comment)}>
            <Text className="text-xs text-blue-500 dark:text-blue-400 mt-1">Reply</Text>
          </TouchableOpacity>
        )}
        {comments
          .filter((c) => c.parent_comment_id === comment.id)
          .map((reply) => renderCommentItem(reply, level + 1))}
      </View>
    );
  };

  return (
    <View className="p-4 border-t border-gray-300 dark:border-gray-600 mt-2">
      <Text className="text-base text-[#3b302a] dark:text-[#d4bfa3] mb-2">Comments</Text>
      {loading ? (
        <Text className="text-xs text-gray-600 dark:text-gray-300">Loading comments...</Text>
      ) : (
        <FlatList
          data={comments.filter((c) => !c.parent_comment_id)}
          renderItem={({ item }) => renderCommentItem(item)}
          keyExtractor={(item) => item.id}
        />
      )}
      {replyTo && (
        <View className="bg-gray-100 dark:bg-gray-700 p-2 my-2">
          <Text className="comment-meta">Replying to: {replyTo.content}</Text>
          <TouchableOpacity onPress={() => setReplyTo(null)}>
            <Text className="text-xs text-red-500">Cancel Reply</Text>
          </TouchableOpacity>
        </View>
      )}
      <View className="flex-row items-center mt-2">
        <TextInput
          value={newComment}
          onChangeText={setNewComment}
          placeholder="Write a comment..."
          className="flex-1 border border-gray-300 dark:border-gray-500 p-2 rounded mr-2"
          placeholderTextColor="#888"
        />
        <CustomButton title="Submit" onPress={handleSubmitComment} />
      </View>
    </View>
  );
}
export default CommentsSection;
EOF
#endregion

#region Scaffold LikeButton Component
cat > "src/components/LikeButton.tsx" << 'EOF'
import React, { useState, useEffect } from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';

interface LikeButtonProps { postId: string; }

export function LikeButton({ postId }: LikeButtonProps) {
  const { user } = useAuthStore();
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);

  const fetchLikes = async () => {
    try {
      const { data, error } = await supabase
        .from('reactions')
        .select('*')
        .eq('post_id', postId);
      if (error) {
        console.error('Error fetching likes:', error);
      } else {
        setLikeCount(data.length);
        const userLike = data.find((r: any) => r.user_id === user.id);
        setLiked(!!userLike);
      }
    } catch (err) {
      console.error('Unexpected error fetching likes:', err);
    }
  };

  useEffect(() => { fetchLikes(); }, [postId]);

  const toggleLike = async () => {
    if (!user) return;
    try {
      if (liked) {
        const { error } = await supabase
          .from('reactions')
          .delete()
          .match({ post_id: postId, user_id: user.id });
        if (error) {
          console.error('Error unliking post:', error);
        } else {
          setLiked(false);
          setLikeCount((prev) => prev - 1);
        }
      } else {
        const { error } = await supabase
          .from('reactions')
          .insert([{ post_id: postId, user_id: user.id, reaction: 'like' }]);
        if (error) {
          console.error('Error liking post:', error);
        } else {
          setLiked(true);
          setLikeCount((prev) => prev + 1);
        }
      }
    } catch (err) {
      console.error('Unexpected error toggling like:', err);
    }
  };

  return (
    <TouchableOpacity style={styles.button} onPress={toggleLike}>
      <Text style={[styles.text, liked && styles.liked]}>
        {liked ? '👍 Liked' : '👍 Like'} ({likeCount})
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: { padding: 6, backgroundColor: '#fff', borderRadius: 4, borderWidth: 1, borderColor: '#ccc', marginTop: 10 },
  text: { fontSize: 14, color: '#333' },
  liked: { color: '#007AFF' },
});
EOF
#endregion

#region HOME SCREEN
cat > "app/(tabs)/home.tsx" << 'EOF'
import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, ActivityIndicator, RefreshControl, Alert, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../src/lib/supabase';
import { useAuthStore } from '../../src/store/useAuthStore';
import { CustomButton } from '../../src/components/CustomButton';
import { ChatMessage } from '../../src/components/ChatMessage';
import { MessageInput } from '../../src/components/MessageInput';
import { fetchProfileForPost } from '../../src/utils/supabaseHelpers';
import { CommentsSection } from '../../src/components/CommentsSection';
import { LikeButton } from '../../src/components/LikeButton';

interface Post {
  id: string;
  content: string;
  created_at: string;
  updated_at: string;
  edited: boolean;
  user_id: string;
  profiles?: { displayName: string };
}

export default function HomeScreen() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [postErrors, setPostErrors] = useState<{ [key: string]: string }>({});

  const fetchPosts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('posts')
        .select('*, profiles!inner(displayName)')
        .order('updated_at', { ascending: false });
      if (error) {
        console.error('Error fetching posts:', error);
      } else {
        setPosts(data as Post[]);
      }
    } catch (err: any) {
      console.error('Unexpected error fetching posts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPosts();
  }, []);

  useEffect(() => {
    const subscription = supabase
      .channel('posts')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'posts' },
        (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const postData: Post = payload.new;
            fetchProfileForPost(postData).then((updatedPost) => {
              setPosts((prevPosts) => {
                let updatedPosts: Post[] = [];
                if (payload.eventType === 'INSERT') {
                  updatedPosts = [...prevPosts, updatedPost];
                } else if (payload.eventType === 'UPDATE') {
                  updatedPosts = prevPosts.map((post) =>
                    post.id === updatedPost.id ? updatedPost : post
                  );
                }
                return updatedPosts.sort(
                  (a, b) =>
                    new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
                );
              });
            });
          } else if (payload.eventType === 'DELETE') {
            setPosts((prevPosts) =>
              prevPosts
                .filter((post) => post.id !== payload.old.id)
                .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
            );
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchPosts();
    setRefreshing(false);
  };

  const handleDeletePost = async (postId: string) => {
    if (Platform.OS === 'web') {
      if (!window.confirm('Are you sure you want to delete this post?')) return;
      console.log('Delete button pressed for post:', postId);
      try {
        const { error } = await supabase
          .from('posts')
          .delete()
          .match({ id: postId, user_id: user?.id });
        if (error) {
          alert('Deletion Failed: ' + error.message);
          setPostErrors((prev) => ({ ...prev, [postId]: error.message }));
        } else {
          setPostErrors((prev) => {
            const updated = { ...prev };
            delete updated[postId];
            return updated;
          });
        }
      } catch (err: any) {
        const message = err.message || 'Deletion failed.';
        alert('Deletion Failed: ' + message);
        setPostErrors((prev) => ({ ...prev, [postId]: message }));
      }
    } else {
      Alert.alert(
        'Delete Post',
        'Are you sure you want to delete this post?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              console.log('Delete button pressed for post:', postId);
              try {
                const { error } = await supabase
                  .from('posts')
                  .delete()
                  .match({ id: postId, user_id: user?.id });
                if (error) {
                  Alert.alert('Deletion Failed', error.message);
                  setPostErrors((prev) => ({ ...prev, [postId]: error.message }));
                } else {
                  setPostErrors((prev) => {
                    const updated = { ...prev };
                    delete updated[postId];
                    return updated;
                  });
                }
              } catch (err: any) {
                const message = err.message || 'Deletion failed.';
                Alert.alert('Deletion Failed', message);
                setPostErrors((prev) => ({ ...prev, [postId]: message }));
              }
            },
          },
        ],
        { cancelable: true }
      );
    }
  };

  const renderPost = ({ item }: { item: Post }) => {
    const posterName =
      item.profiles && item.profiles.displayName ? item.profiles.displayName : 'Unknown';
    const timestamp = item.edited
      ? `${new Date(item.updated_at).toLocaleString()} (edited)`
      : new Date(item.created_at).toLocaleString();

    return (
      <View className="p-4 border-b border-gray-300">
        <Text className="text-[#3b302a] dark:text-[#d4bfa3] text-base">{item.content}</Text>
        <Text className="text-xs text-gray-600 mt-1">Posted by: {posterName}</Text>
        <Text className="text-xs text-gray-600 mt-1">{timestamp}</Text>
        {user && item.user_id === user.id && (
          <View style={{ flexDirection: 'row', marginTop: 8 }}>
            <CustomButton title="Edit" onPress={() => router.push(`/create?id=${item.id}`)} />
            <View style={{ width: 16 }} />
            <CustomButton title="Delete" onPress={() => handleDeletePost(item.id)} />
          </View>
        )}
        <LikeButton postId={item.id} />
        <CommentsSection postId={item.id} />
        {postErrors[item.id] && (
          <Text style={{ color: 'red', marginTop: 4, fontWeight: 'normal' }}>
            {postErrors[item.id]}
          </Text>
        )}
      </View>
    );
  };

  return (
    <View className="flex-1 bg-steampunk-light">
      <View style={{ padding: 16, alignItems: 'center' }}>
        <CustomButton title="New Post" onPress={() => router.push('/create')} />
      </View>
      {loading && posts.length === 0 ? (
        <ActivityIndicator size="large" style={{ marginTop: 20 }} />
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => item.id}
          renderItem={renderPost}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={{ paddingBottom: 20 }}
        />
      )}
    </View>
  );
}
EOF
#endregion

#region Combined CREATE/EDIT SCREEN
cat > "app/(tabs)/create.tsx" << 'EOF'
import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Alert, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CustomButton } from '../../src/components/CustomButton';
import { supabase } from '../../src/lib/supabase';
import { useAuthStore } from '../../src/store/useAuthStore';

export default function CreateEditPostScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { user } = useAuthStore();
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchPost() {
      if (id) {
        const { data, error } = await supabase
          .from('posts')
          .select('*')
          .eq('id', id)
          .eq('user_id', user.id)
          .single();
        if (error) {
          setError(error.message);
        } else {
          setContent(data.content);
        }
      }
    }
    fetchPost();
  }, [id, user]);

  const handleSave = async () => {
    if (!content.trim()) {
      setError('Please enter some content for your post.');
      return;
    }
    setLoading(true);
    setError('');
    if (id) {
      const { error } = await supabase
        .from('posts')
        .update({ content, edited: true })
        .match({ id, user_id: user.id });
      if (error) {
        setError(error.message);
      } else {
        if (Platform.OS === 'web') {
          window.alert('Post Updated: Your post has been updated successfully.');
          router.back();
        } else {
          Alert.alert('Post Updated', 'Your post has been updated successfully.', [
            { text: 'OK', onPress: () => router.back() }
          ]);
        }
      }
    } else {
      const { data, error } = await supabase
        .from('posts')
        .insert([{ user_id: user.id, content }])
        .single();
      if (error) {
        setError(error.message);
      } else {
        if (Platform.OS === 'web') {
          window.alert('Post Created: Your post has been created successfully.');
          router.back();
        } else {
          Alert.alert('Post Created', 'Your post has been created successfully.', [
            { text: 'OK', onPress: () => router.back() }
          ]);
        }
      }
    }
    setLoading(false);
  };

  return (
    <View style={{ flex: 1, padding: 16, backgroundColor: '#f0e6d2' }}>
      <Text style={{ fontSize: 24, marginBottom: 16, color: '#3b302a' }}>
        {id ? 'Edit Your Post' : 'Compose New Post'}
      </Text>
      {error ? <Text style={{ color: 'red', marginBottom: 8 }}>{error}</Text> : null}
      <TextInput
        value={content}
        onChangeText={setContent}
        placeholder="What's on your mind?"
        placeholderTextColor="#5a4a42"
        style={{
          borderWidth: 1,
          borderColor: '#ccc',
          padding: 8,
          borderRadius: 4,
          marginBottom: 16,
          backgroundColor: '#fff',
          color: '#3b302a',
          minHeight: 100,
          textAlignVertical: 'top'
        }}
        multiline
      />
      <CustomButton
        title={loading ? (id ? 'Saving Changes...' : 'Posting...') : (id ? 'Save Changes' : 'Submit Post')}
        onPress={handleSave}
      />
      <CustomButton title="Cancel" onPress={() => router.back()} />
    </View>
  );
}
EOF
#endregion

#region EXPLORE SCREEN
cat > "app/(tabs)/explore.tsx" << 'EOF'
import React from 'react';
import { View, Text } from 'react-native';

export default function ExploreScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-steampunk-light">
      <Text className="text-[#3b302a] dark:text-[#d4bfa3]">Explore Screen</Text>
    </View>
  );
}
EOF
#endregion

#region GROUPS SCREEN
cat > "app/(tabs)/groups.tsx" << 'EOF'
import React from 'react';
import { View, Text } from 'react-native';

export default function GroupsScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-steampunk-light">
      <Text className="text-[#3b302a] dark:text-[#d4bfa3]">Groups Screen</Text>
    </View>
  );
}
EOF
#endregion

#region MAP SCREEN
cat > "app/(tabs)/map.tsx" << 'EOF'
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import MapView, { Marker } from '../../src/components/MapViewWrapper';
import * as Location from 'expo-location';

export default function MapScreen() {
  const [location, setLocation] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrorMsg('Permission to access location was denied');
        return;
      }
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
    backgroundColor: '#f0e6d2',
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
#endregion

#region CHATS SCREEN
cat > "app/(tabs)/chats.tsx" << 'EOF'
import React, { useEffect, useState } from 'react';
import { View, FlatList, Text } from 'react-native';
import RNPickerSelect from 'react-native-picker-select';
import { supabase } from '../../src/lib/supabase';
import { useAuthStore } from '../../src/store/useAuthStore';
import { ChatMessage } from '../../src/components/ChatMessage';
import { MessageInput } from '../../src/components/MessageInput';

export default function ChatsScreen() {
  const { user } = useAuthStore();
  const [contacts, setContacts] = useState<any[]>([]);
  const [selectedContact, setSelectedContact] = useState<any>(null);
  const [conversationId, setConversationId] = useState<string>('');
  const [messages, setMessages] = useState<any[]>([]);

  useEffect(() => {
    async function fetchContacts() {
      const { data, error } = await supabase.from('users').select('*');
      if (error) {
        console.error('Error fetching contacts:', error);
      } else {
        const otherUsers = data.filter((u: any) => u.id !== user.id);
        setContacts(otherUsers);
      }
    }
    fetchContacts();
  }, [user]);

  useEffect(() => {
    if (!selectedContact) return;
    async function fetchOrCreateConversation() {
      const { data: existingConversation } = await supabase
        .from('conversations')
        .select('*')
        .or(
          `and(user1.eq.${user.id},user2.eq.${selectedContact.id}),and(user1.eq.${selectedContact.id},user2.eq.${user.id})`
        )
        .maybeSingle();
      let convId = '';
      if (existingConversation) {
        convId = existingConversation.id;
      } else {
        const { data: newConversation, error: insertError } = await supabase
          .from('conversations')
          .insert({
            user1: user.id,
            user2: selectedContact.id,
          })
          .select('*')
          .maybeSingle();
        if (insertError) {
          console.error('Error creating conversation:', insertError);
          return;
        }
        convId = newConversation.id;
      }
      setConversationId(convId);
    }
    fetchOrCreateConversation();
  }, [selectedContact, user]);

  useEffect(() => {
    if (!conversationId) return;
    async function fetchMessages() {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });
      if (error) {
        console.error('Error fetching messages:', error);
      } else {
        setMessages(data);
      }
    }
    fetchMessages();

    const channel = supabase
      .channel(`conversation-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setMessages((prev) => [...prev, payload.new]);
          } else if (payload.eventType === 'UPDATE') {
            setMessages((prev) =>
              prev.map((msg) => (msg.id === payload.new.id ? payload.new : msg))
            );
          } else if (payload.eventType === 'DELETE') {
            setMessages((prev) =>
              prev.filter((msg) => msg.id !== payload.old.id)
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId]);

  const sendMessage = async (text: string) => {
    if (!conversationId || text.trim() === '') return;
    const { error } = await supabase.from('messages').insert({
      conversation_id: conversationId,
      sender_id: user.id,
      content: text,
    });
    if (error) {
      console.error('Error sending message:', error);
    }
  };

  return (
    <View className="flex-1 bg-steampunk-light">
      <RNPickerSelect
        onValueChange={(value) => {
          const contact = contacts.find((c) => c.id === value);
          setSelectedContact(contact);
        }}
        value={selectedContact ? selectedContact.id : ''}
        placeholder={{ label: 'Select a contact', value: '' }}
        items={contacts.map((contact) => ({
          label: contact.displayName || contact.email,
          value: contact.id,
        }))}
        style={{
          inputIOS: { backgroundColor: '#fff', padding: 12, margin: 8 },
          inputAndroid: { backgroundColor: '#fff', padding: 12, margin: 8 },
          inputWeb: { backgroundColor: '#fff', padding: 12, margin: 8 },
        }}
      />

      {selectedContact && (
        <View className="p-4 border-b border-gray-300">
          <Text className="text-lg font-bold text-[#3b302a] dark:text-[#d4bfa3]">
            Chat with {selectedContact.displayName || selectedContact.email}
          </Text>
        </View>
      )}

      <FlatList
        data={messages}
        renderItem={({ item }) => (
          <ChatMessage message={item} isOwnMessage={item.sender_id === user.id} />
        )}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 10 }}
      />

      <MessageInput onSend={sendMessage} />
    </View>
  );
}
EOF
#endregion

#region CUES SCREEN
cat > "app/(tabs)/cues.tsx" << 'EOF'
import React from 'react';
import { View, Text } from 'react-native';

export default function CuesScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-steampunk-light">
      <Text className="text-[#3b302a] dark:text-[#d4bfa3]">Cues</Text>
    </View>
  );
}
EOF
#endregion

#region PROFILE SCREEN
cat > "app/(tabs)/profile.tsx" << 'EOF'
import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { supabase } from '../../src/lib/supabase';
import { useAuthStore } from '../../src/store/useAuthStore';
import { useRouter } from 'expo-router';
import { useTheme } from '../../src/context/ThemeContext';
import { CustomButton } from '../../src/components/CustomButton';

export default function ProfileScreen() {
  const { setUser, user } = useAuthStore();
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    async function fetchProfile() {
      if (user) {
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .eq('id', user.id)
          .single();
        if (error) {
          console.error('Error fetching profile:', error);
        } else {
          setProfile(data);
        }
      }
    }
    fetchProfile();
  }, [user]);

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
    <View className="flex-1 bg-steampunk-light p-4 justify-between">
      <View>
        {profile ? (
          <View className="mb-6 space-y-3">
            <View>
              <Text className="text-sm text-[#3b302a] dark:text-[#d4bfa3]">Display Name:</Text>
              <Text className="text-lg text-[#3b302a] dark:text-[#d4bfa3]">
                {profile.displayName || 'N/A'}
              </Text>
            </View>
            <View>
              <Text className="text-sm text-[#3b302a] dark:text-[#d4bfa3]">Email:</Text>
              <Text className="text-lg text-[#3b302a] dark:text-[#d4bfa3]">
                {profile.email}
              </Text>
            </View>
            <View>
              <Text className="text-sm text-[#3b302a] dark:text-[#d4bfa3]">Bio:</Text>
              <Text className="text-lg text-[#3b302a] dark:text-[#d4bfa3]">
                {profile.bio || 'No bio available.'}
              </Text>
            </View>
          </View>
        ) : (
          <Text className="text-base text-[#3b302a] dark:text-[#d4bfa3] mb-6">Loading profile...</Text>
        )}
      </View>

      <View className="space-y-4">
        <Text onPress={() => router.push('/profileEdit')} className="link text-center text-sm">
          Edit Profile
        </Text>
        <CustomButton
          title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
          onPress={toggleTheme}
        />
        <CustomButton title="Log Out" onPress={handleLogout} />
      </View>
    </View>
  );
}
EOF
#endregion

#region Scaffold Profile Edit Screen
cat > "app/profileEdit.tsx" << 'EOF'
import React, { useState, useEffect } from 'react';
import { View, Text, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../src/lib/supabase';
import { useAuthStore } from '../src/store/useAuthStore';
import { CustomButton } from '../src/components/CustomButton';

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

#region Add Missing Component Implementations (ChatMessage)
cat > "src/components/ChatMessage.tsx" << 'EOF'
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useAuthStore } from '../store/useAuthStore';

interface ChatMessageProps {
  message: any;
  isOwnMessage: boolean;
}

export function ChatMessage({ message, isOwnMessage }: ChatMessageProps) {
  const { user } = useAuthStore();
  
  return (
    <View style={[styles.messageContainer, isOwnMessage ? styles.ownMessage : styles.otherMessage]}>
      <Text style={styles.messageContent}>
        {message.content}{message.updated_at ? ' (edited)' : ''}
      </Text>
      <Text style={styles.timestamp}>
        {new Date(message.created_at).toLocaleTimeString()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  messageContainer: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 8,
    marginVertical: 4,
  },
  ownMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#c0a080',
    borderColor: '#3b302a',
  },
  otherMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#e0d0c0',
    borderColor: '#5a4a42',
  },
  messageContent: {
    fontSize: 16,
    color: '#3b302a',
  },
  timestamp: {
    fontSize: 10,
    color: '#5a4a42',
    alignSelf: 'flex-end',
    marginTop: 4,
  },
});
EOF

cat > "src/components/MessageInput.tsx" << 'EOF'
import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface MessageInputProps {
  onSend: (text: string) => void;
}

export function MessageInput({ onSend }: MessageInputProps) {
  const [message, setMessage] = useState('');

  const handleSend = () => {
    if (message.trim()) {
      onSend(message);
      setMessage('');
    }
  };

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        value={message}
        onChangeText={setMessage}
        placeholder="Type a message..."
        placeholderTextColor="#5a4a42"
        multiline
      />
      <TouchableOpacity onPress={handleSend} style={styles.sendButton}>
        <Ionicons name="send" size={24} color="#3b302a" />
      </TouchableOpacity>
    </View>
  );
}

const styles = {
  container: { flexDirection: 'row', alignItems: 'center', padding: 8, backgroundColor: '#f0e6d2', borderTopWidth: 1, borderColor: '#3b302a' },
  input: { flex: 1, minHeight: 40, maxHeight: 100, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#ffffff', borderRadius: 20, borderWidth: 1, borderColor: '#3b302a', marginRight: 8, color: '#3b302a' },
  sendButton: { padding: 8, borderRadius: 20, backgroundColor: '#c0a080' },
};
EOF
#endregion

#region Supabase Client
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
echo "2. Run your backend SQL schema initialization and seed scripts in your Supabase SQL editor."
echo "3. Verify the Zustand auth store in src/store/useAuthStore.ts."
echo "4. Update Tailwind and NativeWind configurations in tailwind.config.js if required."
echo "5. Review the new messaging, post, and combined create/edit post feature files."
echo "6. Run and test the auth, messenger, and post flow. For web: npx expo start --clear"
echo "🚀 Starting Expo development server..."
npx expo start --clear
#endregion
