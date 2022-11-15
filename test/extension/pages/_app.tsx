import type { AppProps } from 'next/app'
import '../styles/globals.css'

export default function App({ Component, pageProps }: AppProps) {
  return <div className="w-[337.50px] h-[600px]">
    <Component {...pageProps} />
  </div>
}
