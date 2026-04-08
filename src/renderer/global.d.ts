export {};

declare module "*.css" {
  const content: string;
  export default content;
}

declare global {
  interface Window {
    electronAPI: {
      openImage: () => Promise<{ dataUrl: string; path: string } | null>;
      saveImage: (dataUrl: string) => Promise<string | null>;
    };
  }
}