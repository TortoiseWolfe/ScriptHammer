#!/usr/bin/env bash
set -eo pipefail

##############################################
        # Expo Setup Script Template
##############################################

#region Metadata and Configuration
# -----------------------------------------------------------------------------
# Script Name:        expo-setup.sh
# Description:        Non-Interactive Expo setup script for initializing an
#                     Expo project with additional configuration for Supabase,
#                     Zustand, Tailwind + NativeWind, etc.
# Author:             TurtleWolfe@ScriptHammer.com
# Created:            2025-02-08
# Version:            1.1.0
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
# Load environment variables from .env file if it exists
if [ -f .env ]; then
  set -o allexport
  source .env
  set +o allexport
else
  echo "ERROR: .env file not found."
  echo "Create one with the following minimum content:"
  echo "APP_NAME=\"my-app\""
  exit 1
fi

# Validate required variables
required_vars=("APP_NAME")
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

# Clean up default project
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
  # "@expo/vector-icons"
  # "expo-router"
  # "react-native-reanimated"
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

# Install function to skip commented packages
install_deps() {
  local arr_name=("$@")
  for dep in "${arr_name[@]}"; do
    if [[ $dep != \#* ]]; then
      if [[ $dep == nativewind* ]]; then
        npm install "$dep"
      else
        npm install "$dep"
      fi
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

# Array-based structure definition with commented options
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
  # "src/app/(auth)/"
  # "src/app/(auth)/_layout.tsx"
  # "src/app/(auth)/signIn.tsx"
  # "src/app/(auth)/signUp.tsx"
  
  # Tabs route group
  # "src/app/(tabs)/"
  # "src/app/(tabs)/_layout.tsx"
  # "src/app/(tabs)/index.tsx"
  # "src/app/(tabs)/create.tsx"
  # "src/app/(tabs)/explore.tsx"
  # "src/app/(tabs)/groups.tsx"
  # "src/app/(tabs)/map.tsx"
  # "src/app/(tabs)/messages.tsx"
  # "src/app/(tabs)/notifications.tsx"
  # "src/app/(tabs)/profile.tsx"
  
  # Admin route group
  # "src/app/(admin)/"
  # "src/app/(admin)/_layout.tsx"
  # "src/app/(admin)/index.tsx"
  
  # Additional directories
  # "src/lib/"
  # "src/lib/supabase.ts"
  # "src/store/"
  # "src/store/useAuthStore.ts"
  # "src/store/useThemeStore.ts"
  # "src/components/"
)

# Create structure while ignoring comments
for item in "${dir_structure[@]}"; do
  if [[ $item != \#* ]]; then
    if [[ $item == *"/" ]]; then
      mkdir -p "$item"
    else
      touch "$item"
    fi
  fi
done
#endregion

#region Configuration Files
echo "⚙️  Generating configuration files..."

# # Babel configuration
# cat > babel.config.js << EOF
# module.exports = function (api) {
#   api.cache(true);
#   return {
#     presets: ['babel-preset-expo'],
#     plugins: ['nativewind/babel'],
#   };
# };
# EOF

# Tailwind configuration
# npx tailwindcss init -p
#endregion

#region Final Setup
echo "✅ Project setup complete!"
echo "Next steps:"
echo "1. Configure Supabase client in src/lib/supabase.ts"
echo "2. Set up Zustand stores in src/store/"
echo "3. Update Tailwind config for NativeWind"
echo "4. Add your environment variables in .env.local"

# Start development server
echo "🚀 Starting Expo development server..."
npx expo start --clear
#endregion
