import { Star } from 'lucide-react';

interface Props {
  rating: number;
  size?: number;
  className?: string;
}

/** 별점 표시 (이모지 대신 Lucide 아이콘 사용) */
export default function Stars({ rating, size = 14, className = '' }: Props) {
  const filled = Math.max(0, Math.min(5, Math.round(rating)));
  return (
    <span className={`inline-flex items-center gap-0.5 ${className}`} aria-label={`5점 만점에 ${filled}점`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          size={size}
          strokeWidth={1.8}
          className={n <= filled ? 'fill-amber-400 text-amber-400' : 'text-zinc-300'}
        />
      ))}
    </span>
  );
}
