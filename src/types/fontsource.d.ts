// Ambient module declaration for @fontsource-variable side-effect imports.
// The packages export only CSS; TypeScript bundler resolution needs a typed shim.
// Used by src/tabs/kesehatan/KesehatanModulLayout.tsx to lazy-bundle Fraunces with the modul chunk.

declare module '@fontsource-variable/fraunces'
declare module '@fontsource-variable/geist'
