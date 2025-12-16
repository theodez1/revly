declare module 'expo-file-system' {
  // Ensure documentDirectory and commonly used helpers are available on the type, as used in the app.
  export const documentDirectory: string | null | undefined;

  export interface FileInfo {
    uri: string;
    exists: boolean;
    isDirectory?: boolean;
    size?: number;
    modificationTime?: number;
    md5?: string | null;
  }

  // Relaxed signatures – we only care that they exist for TS.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export function readAsStringAsync(uri: string, options?: any): Promise<string>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export function writeAsStringAsync(uri: string, contents: string, options?: any): Promise<void>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export function getInfoAsync(uri: string, options?: any): Promise<FileInfo>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export function makeDirectoryAsync(uri: string, options?: any): Promise<void>;
  // eslint-disable-next-line @typescript-eslint/no-explicitany
  export function copyAsync(options: { from: string; to: string }): Promise<void>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export function deleteAsync(uri: string, options?: any): Promise<void>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export function downloadAsync(uri: string, fileUri: string, options?: any): Promise<any>;
}



