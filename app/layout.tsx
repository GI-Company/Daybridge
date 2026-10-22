import type { Metadata, Viewport } from 'next';
import './globals.css';
export const metadata: Metadata = {
 title:'DayBridge — Private Daily Organizer',
 description:'A private personal organizer for scheduling, budget, prescriptions and everyday tasks.',
 manifest:'/manifest.webmanifest',
 robots:{index:false,follow:false},
 icons:{icon:'/icon-192.png',apple:'/icon-192.png'},
 appleWebApp:{capable:true,title:'DayBridge',statusBarStyle:'default'},
};
export const viewport: Viewport = {width:'device-width',initialScale:1,themeColor:'#f8fafc'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body className="min-h-screen bg-slate-50 text-slate-900 antialiased">{children}</body></html>}
