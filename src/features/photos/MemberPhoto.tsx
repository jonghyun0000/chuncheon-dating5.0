import { useEffect, useState } from 'react';
import { UserRound } from 'lucide-react';
import { useI18n } from '@/i18n';
import { photoCopy } from './photoCopy';
import Modal from '@/components/common/Modal';
import { photoBlob } from './photos.api';

interface Props {
  path?: string;
  nickname: string;
  avatar?: boolean;
}

export default function MemberPhoto({ path, nickname, avatar = false }: Props) {
  const { lang } = useI18n();
  const copy = photoCopy(lang);
  const [url, setUrl] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    let localUrl: string | undefined;
    setUrl(null);
    setOpen(false);
    setFailed(false);
    if (!path) return;
    photoBlob(path).then(blob => {
      if (cancelled) return;
      localUrl = URL.createObjectURL(blob); setUrl(localUrl);
    }).catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; if (localUrl) URL.revokeObjectURL(localUrl); };
  }, [path]);
  const avatarFrame = 'grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full bg-sakura-50 text-sakura-600 ring-1 ring-sakura-200';
  if (!url || failed) {
    if (avatar) {
      return (
        <span aria-hidden="true" className={avatarFrame}>
          <UserRound size={19} strokeWidth={1.7} />
        </span>
      );
    }
    if (!path) return null;
    return <span className="text-xs text-zinc-400">{failed ? copy.failed : copy.loading}</span>;
  }

  const title = avatar ? `${nickname} ${copy.profilePhoto}` : `${nickname} ${copy.photo}`;
  return (
    <>
      <button
        type="button"
        onClick={(event) => { event.currentTarget.focus(); setOpen(true); }}
        aria-label={`${nickname} ${copy.expand}`}
        className={avatar
          ? `${avatarFrame} focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sakura-600`
          : 'my-2 block overflow-hidden rounded-xl'}
      >
        <img
          src={url}
          alt=""
          className={avatar ? 'h-full w-full object-cover' : 'h-32 w-32 object-cover'}
          onError={() => setFailed(true)}
          loading="lazy"
        />
      </button>
      {open && (
        <Modal open onClose={() => setOpen(false)} title={title}>
          <img src={url} alt={title} className="max-h-[65dvh] w-full object-contain" />
          <button type="button" className="btn-ghost mt-3" onClick={() => setOpen(false)}>{copy.close}</button>
        </Modal>
      )}
    </>
  );
}
