/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'm.atcdn.co.uk' },
      { protocol: 'https', hostname: 'cdn.motors.co.uk' },
      { protocol: 'https', hostname: 'i.ebayimg.com' },
      { protocol: 'https', hostname: 'media.gumtree.com' },
      { protocol: 'https', hostname: 'images.autotrader.co.uk' },
      { protocol: 'https', hostname: 'picsum.photos' },
      { protocol: 'https', hostname: 'fastly.picsum.photos' },
    ],
  },
}

module.exports = nextConfig
