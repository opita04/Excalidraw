import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import Script from 'next/script'
import '@excalidraw/excalidraw/index.css'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
	title: 'Excalidraw with Vercel Blob',
	description: 'Excalidraw drawing app with cloud storage',
}

export default function RootLayout({
	children,
}: {
	children: React.ReactNode
}) {
	return (
		<html lang="en">
			<head>
				<Script id="excalidraw-asset-path" strategy="beforeInteractive">
					{`window["EXCALIDRAW_ASSET_PATH"] = "/";`}
				</Script>
			</head>
			<body className={inter.className}>{children}</body>
		</html>
	)
}
