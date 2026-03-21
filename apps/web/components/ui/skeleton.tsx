"use client"

type SkeletonProps = {
  className?: string
  height?: number
}

export function Skeleton({ className = "", height = 16 }: SkeletonProps) {
  return (
    <>
      <div className={`skeleton ${className}`.trim()} style={{ height }} />
      <style jsx>{`
        .skeleton {
          position: relative;
          overflow: hidden;
          border-radius: 10px;
          background: #161b22;
        }

        .skeleton::after {
          content: "";
          position: absolute;
          inset: 0;
          transform: translateX(-100%);
          background: linear-gradient(
            90deg,
            transparent 0%,
            rgba(255, 255, 255, 0.04) 30%,
            rgba(46, 204, 138, 0.08) 50%,
            rgba(255, 255, 255, 0.04) 70%,
            transparent 100%
          );
          animation: shimmer 1.4s ease-in-out infinite;
        }

        @keyframes shimmer {
          to {
            transform: translateX(100%);
          }
        }
      `}</style>
    </>
  )
}

export function StatCardSkeleton() {
  return (
    <div className="card">
      <Skeleton height={14} />
      <Skeleton className="value" height={36} />
      <style jsx>{`
        .card {
          border: 1px solid #21262d;
          border-radius: 12px;
          background: #161b22;
          padding: 20px 24px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .value {
          width: 72%;
        }
      `}</style>
    </div>
  )
}

export function ChartSkeleton() {
  return (
    <div className="card">
      <Skeleton className="heading" height={18} />
      <Skeleton className="subheading" height={12} />
      <Skeleton className="chart" height={280} />
      <style jsx>{`
        .card {
          border: 1px solid #21262d;
          border-radius: 12px;
          background: #161b22;
          padding: 20px 24px;
        }

        .heading {
          width: 200px;
          margin-bottom: 10px;
        }

        .subheading {
          width: 140px;
          margin-bottom: 18px;
        }

        .chart {
          border-radius: 14px;
        }
      `}</style>
    </div>
  )
}

export function TableRowSkeleton() {
  return (
    <div className="row">
      <Skeleton height={14} />
      <Skeleton height={14} />
      <Skeleton height={14} />
      <Skeleton height={14} />
      <style jsx>{`
        .row {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 16px;
          align-items: center;
          border: 1px solid #21262d;
          border-radius: 12px;
          background: #161b22;
          padding: 16px;
        }

        @media (max-width: 767px) {
          .row {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  )
}

export function CardSkeleton() {
  return (
    <div className="card">
      <Skeleton className="heading" height={18} />
      <Skeleton className="line" height={12} />
      <Skeleton className="line short" height={12} />
      <style jsx>{`
        .card {
          border: 1px solid #21262d;
          border-radius: 12px;
          background: #161b22;
          padding: 24px;
        }

        .heading {
          width: 180px;
          margin-bottom: 18px;
        }

        .line {
          margin-bottom: 12px;
        }

        .short {
          width: 72%;
          margin-bottom: 0;
        }
      `}</style>
    </div>
  )
}
