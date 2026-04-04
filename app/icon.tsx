import { ImageResponse } from 'next/og'

// Image metadata
export const size = {
  width: 32,
  height: 32,
}
export const contentType = 'image/png'

// Image generation
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '6px',
          position: 'relative',
        }}
      >
        {/* 毕业帽图标 - 代表导师/教育 */}
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* 帽子主体 */}
          <path
            d="M12 3L2 8L12 13L22 8L12 3Z"
            fill="white"
            stroke="white"
            stroke-width="1.5"
            stroke-linejoin="round"
          />
          {/* 帽子流苏 */}
          <path
            d="M22 8V13"
            stroke="white"
            stroke-width="1.5"
            stroke-linecap="round"
          />
          <circle
            cx="22"
            cy="14"
            r="1"
            fill="white"
          />
          {/* 帽檐 */}
          <path
            d="M6 10.5V15C6 16.66 8.69 18 12 18C15.31 18 18 16.66 18 15V10.5"
            stroke="white"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </div>
    ),
    {
      ...size,
    }
  )
}
