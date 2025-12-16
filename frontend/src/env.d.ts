// Allow importing CSS/images in TS files without type errors during migration
declare module '*.css';
declare module '*.scss';

// Generic image imports resolve to the URL string returned by the bundler
declare module '*.png' {
	const value: string;
	export default value;
}
declare module '*.jpg' {
	const value: string;
	export default value;
}
declare module '*.jpeg' {
	const value: string;
	export default value;
}
declare module '*.gif' {
	const value: string;
	export default value;
}

// SVGs can be imported as URL (default) or as a React component named `ReactComponent`.
declare module '*.svg' {
	import * as React from 'react';
	export const ReactComponent: React.FunctionComponent<React.SVGProps<SVGSVGElement> & { title?: string }>;
	const src: string;
	export default src;
}

export {};
