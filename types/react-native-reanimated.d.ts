declare module 'react-native-reanimated' {
  // Relaxed typings for APIs used in the app to satisfy TypeScript.
  // The actual runtime implementation is provided by the library.

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const View: any;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export function useSharedValue<T = any>(initialValue: T): { value: T };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export function useAnimatedStyle<T extends object = any>(updater: () => T): any;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export function withTiming(...args: any[]): any;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export function withSpring(...args: any[]): any;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export function runOnJS<T extends (...args: any[]) => any>(fn: T): T;

  // Old API used in some parts of the codebase
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export function useAnimatedGestureHandler(...args: any[]): any;
}


