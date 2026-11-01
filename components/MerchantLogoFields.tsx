import React, { useRef, useState } from 'react';
import { toast } from 'sonner';
import { isBrandfetchLogoRefreshable } from '../utils/brandfetch';
import { Button } from './ui/Actions';
import { TextInput } from './ui/Fields';
import Icon from './ui/Icon';
import { cn } from '../lib/utils';

const isUploaded = (logo: string) => logo.startsWith('data:image/') || logo.startsWith('http://') || logo.startsWith('https://');

interface MerchantLogoFieldsProps {
  merchantName: string;
  logo: string;
  previewUrl: string | null;
  website: string;
  onLogoChange: (logo: string) => void;
  onWebsiteChange: (website: string) => void;
  onRefresh: () => void;
}

const MerchantLogoFields: React.FC<MerchantLogoFieldsProps> = ({ merchantName, logo, previewUrl, website, onLogoChange, onWebsiteChange, onRefresh }) => {
  const fileInput = useRef<HTMLInputElement>(null);
  const [isDragging, setDragging] = useState(false);
  const uploaded = isUploaded(logo);

  const readFile = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Choose an image file, such as PNG, JPG, SVG or WEBP.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => { if (typeof reader.result === 'string') onLogoChange(reader.result); };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="type-label flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-[var(--radius-md)] bg-inset text-muted">
          {previewUrl ? <img src={previewUrl} alt="" className="size-full object-cover" /> : merchantName.charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <p className="type-body-strong text-ink">{uploaded ? 'Your own image' : logo ? logo : 'Found automatically'}</p>
          <p className="type-caption text-muted">{uploaded ? 'Used instead of Brandfetch.' : 'From Brandfetch.'}</p>
        </div>
        {uploaded && <Button variant="ghost" size="sm" onPress={() => onLogoChange('')}>Remove</Button>}
      </div>

      <div className="flex items-end gap-2">
        <TextInput className="min-w-0 flex-1" label="Brand website" help="The logo is looked up from this domain." placeholder="apple.com" value={uploaded ? '' : logo} onChange={onLogoChange} />
        {isBrandfetchLogoRefreshable(merchantName, logo) && <Button variant="secondary" icon="sync" className="mb-6" onPress={onRefresh}>Fetch</Button>}
      </div>

      <div>
        <p className="type-label mb-1.5 text-ink">Your own image</p>
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          onDragOver={event => { event.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={event => { event.preventDefault(); setDragging(false); readFile(event.dataTransfer.files[0]); }}
          className={cn('flex w-full cursor-pointer flex-col items-center gap-1 rounded-[var(--radius-lg)] border border-dashed border-line-strong p-5 text-center hover:bg-inset', isDragging && 'bg-primary-soft')}
        >
          <Icon name="upload_file" size={24} className="text-muted" />
          <span className="type-body-strong text-ink">Choose or drop an image</span>
          <span className="type-caption text-muted">PNG, SVG, JPG or WEBP</span>
        </button>
        <input ref={fileInput} type="file" accept="image/*" aria-label="Logo image" className="sr-only" tabIndex={-1} onChange={event => readFile(event.target.files?.[0])} />
      </div>

      <TextInput label="Website" placeholder="https://www.example.com" value={website} onChange={onWebsiteChange} />
    </div>
  );
};

export default MerchantLogoFields;
