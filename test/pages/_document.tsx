import { Head, Html, Main, NextScript } from 'next/document'
import Script from 'next/script'

export default function Document() {
  return <Html>
    <Head>
      <Script src="/forge.min.js" strategy="lazyOnload" />
    </Head>
    <body>
      <Main />
      <NextScript />
    </body>
  </Html>
}