import React from 'react';
import { View, TouchableOpacity, Animated, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { NavigationContainer, useNavigation } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Home, Users, Plus, Clock, User, Square } from 'lucide-react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { TrackingProvider, useTracking } from './contexts/TrackingContext';
import { TrackingEngineProvider, useTrackingEngine } from './contexts/TrackingEngineContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { useCustomFonts } from './hooks/useCustomFonts';
import Mapbox from '@rnmapbox/maps';

// ⚠️ TODO: Remplacer par votre clé publique Mapbox (pk.eyJ...)
// Vous pouvez la trouver sur https://account.mapbox.com/
Mapbox.setAccessToken('pk.eyJ1IjoidGhlb2RleiIsImEiOiJjbWlucnN0aHAwdm10M2VzYmlhazRoYTJmIn0.CSxFH7X6P8dQk6CAzILUEA');

// Screens - Organized by feature
// Auth
import LoginScreen from './screens/auth/LoginScreen';
import SignUpScreen from './screens/auth/SignUpScreen';
import OnboardingScreen from './screens/onboarding/OnboardingScreen';

// Tracking
import FullMapScreen from './screens/map/MapScreenFull';

// Feed
import RunsScreen from './screens/activity/RunsScreen';
import RunDetailScreen from './screens/activity/RunDetailScreen';
import HistoryScreen from './screens/activity/HistoryScreen';

// Social
import GroupsScreen from './screens/groups/GroupsScreen';
import GroupDetailScreen from './screens/groups/GroupDetailScreen';
import CreateGroupScreen from './screens/groups/CreateGroupScreen';
import AllGroupsScreen from './screens/groups/AllGroupsScreen';
import DiscoverGroupsScreen from './screens/groups/DiscoverGroupsScreen';
import AllChallengesScreen from './screens/groups/AllChallengesScreen';
import ProfileScreen from './screens/profile/ProfileScreen';
import UserProfileScreen from './screens/profile/UserProfileScreen';
import ShareActivityScreen from './screens/activity/ShareActivityScreen';

// Settings
import SettingsScreen from './screens/settings/SettingsScreen';
import EditProfileScreen from './screens/profile/EditProfileScreen';
import PaywallScreen from './screens/settings/PaywallScreen';

// Debug
import StatsScreen from './screens/profile/StatsScreen';
import TrackingLogsScreen from './screens/activity/TrackingLogsScreen';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

function PulseIndicator() {
  const trackingEngine = useTrackingEngine();
  const isTracking = trackingEngine?.isTracking || false;
  const isPaused = trackingEngine?.isPaused || false;
  const pulseAnim = React.useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    if (isTracking && !isPaused) {
      // Animation de pulse infinie
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.15,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isTracking, isPaused]);

  if (!isTracking) return null;

  return (
    <Animated.View
      style={[
        styles.pulseCircle, // Changed from pulseRing
        {
          transform: [{ scale: pulseAnim }],
          opacity: isPaused ? 0.5 : 1,
        },
      ]}
    />
  );
}

function TabIconWithPulse({ route, focused, color, size, navigation }) {
  const trackingEngine = useTrackingEngine();
  const isTracking = trackingEngine?.isTracking || false;
  const isPaused = trackingEngine?.isPaused || false;
  const timeText = trackingEngine?.timeText || '00:00';

  // Use Lucide icons
  if (route.name === 'Feed') {
    return <Home size={size} color={color} strokeWidth={focused ? 2.5 : 2} />;
  } else if (route.name === 'Record') {
    // Si un trajet est en cours, afficher un carré rouge (style stop)
    if (isTracking) {
      return (
        <View style={styles.middleTab}>
          <Square
            size={20}
            color="#fff"
            fill={isPaused ? "rgba(255,255,255,0.3)" : "#EF4444"}
            strokeWidth={2}
          />
        </View>
      );
    }
    // Sinon, afficher le + normal
    return (
      <View style={styles.middleTab}>
        <Plus size={32} color="#fff" strokeWidth={2.5} />
      </View>
    );
  } else if (route.name === 'Groups') {
    return <Users size={size} color={color} strokeWidth={focused ? 2.5 : 2} />;
  } else if (route.name === 'History') {
    return <Clock size={size} color={color} strokeWidth={focused ? 2.5 : 2} />;
  } else if (route.name === 'Profile') {
    return <User size={size} color={color} strokeWidth={focused ? 2.5 : 2} />;
  }

  return null;
}

function MainTabs({ navigation }) {
  return (
    <Tab.Navigator
      lazy={false}
      screenOptions={({ route }) => ({
        tabBarIcon: (props) => <TabIconWithPulse {...props} route={route} />,
        tabBarActiveTintColor: '#1E3A8A',
        tabBarInactiveTintColor: 'gray',
        headerShown: false,
        tabBarButton: (props) => {
          const { ref, ...rest } = props;
          if (props.accessibilityState?.selected && props.route === 'Record') {
            return <TouchableOpacity {...rest} style={[props.style, { marginBottom: 20 }]} />;
          }
          return <TouchableOpacity {...rest} />;
        },
      })}
    >
      <Tab.Screen
        name="Feed"
        component={RunsScreen}
        options={{ title: 'Feed' }}
      />
      <Tab.Screen
        name="Groups"
        component={GroupsScreen}
        options={{ title: 'Groupe' }}
      />
      <Tab.Screen
        name="Record"
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            e.preventDefault();
            navigation.navigate('RecordTrip');
          },
        })}
        options={{ title: '' }}
        component={RunsScreen}
      />
      <Tab.Screen
        name="History"
        component={HistoryScreen}
        options={{ title: 'Historique' }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ title: 'Profil' }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  middleTab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#1E3A8A',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: -28,
    shadowColor: '#1E3A8A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    position: 'relative',
    overflow: 'visible',
  },
  pulseCircle: {
    position: 'absolute',
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#3B82F6',
    opacity: 0.3,
  },
});


// Stack d'authentification (non connecté)
function AuthStack() {
  return (
    <Stack.Navigator lazy={false} screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="SignUp" component={SignUpScreen} />
    </Stack.Navigator>
  );
}

// Stack principal (connecté)
function AppStack() {
  return (
    <Stack.Navigator lazy={false} screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MainTabs" component={MainTabs} />
      <Stack.Screen
        name="RecordTrip"
        component={FullMapScreen}
        options={{
          presentation: 'modal',
          animation: 'slide_from_bottom',
          contentStyle: { flex: 1 }
        }}
      />
      <Stack.Screen name="Paywall" component={PaywallScreen} />
      <Stack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          headerShown: false,
          gestureEnabled: false,
        }}
      />
      <Stack.Screen
        name="RunDetail"
        component={RunDetailScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="EditProfile"
        component={EditProfileScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="ShareActivity"
        component={ShareActivityScreen}
        options={{
          presentation: 'modal',
          animation: 'slide_from_bottom',
          headerShown: false
        }}
      />
      <Stack.Screen
        name="AllChallenges"
        component={AllChallengesScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="AllGroups"
        component={AllGroupsScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="DiscoverGroups"
        component={DiscoverGroupsScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="GroupDetail"
        component={GroupDetailScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="CreateGroup"
        component={CreateGroupScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="UserProfile"
        component={UserProfileScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}

import { isOnboardingCompleted } from './screens/onboarding/OnboardingScreen';

// Navigation conditionnelle
function RootNavigator() {
  const { isAuthenticated, loading } = useAuth();
  const navigation = React.useRef(null);
  const [onboardingComplete, setOnboardingComplete] = React.useState(null);

  React.useEffect(() => {
    isOnboardingCompleted().then(setOnboardingComplete);
  }, []);

  // Pendant le chargement, afficher un écran de chargement
  if (loading || onboardingComplete === null) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0F172A' }}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  if (!onboardingComplete) {
    return <OnboardingScreen onComplete={() => setOnboardingComplete(true)} />;
  }

  // Après le chargement, afficher la bonne stack selon l'authentification
  return isAuthenticated ? <AppStack /> : <AuthStack />;
}

export default function App() {
  const fontsLoaded = useCustomFonts();

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0F172A' }}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <BottomSheetModalProvider>
          <AuthProvider>
            <TrackingProvider>
              <NavigationContainer>
                <TrackingEngineProvider>
                  <RootNavigator />
                </TrackingEngineProvider>
              </NavigationContainer>
            </TrackingProvider>
          </AuthProvider>
        </BottomSheetModalProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
