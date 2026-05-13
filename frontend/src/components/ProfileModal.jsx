import { useCallback, useRef, useState } from 'react';
import Cropper from 'react-easy-crop';
import { MdClose, MdPhotoCamera } from 'react-icons/md';
import toast from 'react-hot-toast';
import api from '../api/axios';
import Spinner from './Spinner';
import { mediaUrl } from '../utils/mediaUrl';
import { getCroppedImgBlob } from '../utils/cropImage';

const MAX_FILE_BYTES = 450 * 1024;
const CROP_OUTPUT_SIZE = 384;

/** Centered profile: read-only details + avatar upload (PNG/JPEG) with crop / center step */
const ProfileModal = ({ user, onClose, onAvatarSaved }) => {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [cropSourceUrl, setCropSourceUrl] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

  const revokeCropUrl = () => {
    if (cropSourceUrl) {
      URL.revokeObjectURL(cropSourceUrl);
      setCropSourceUrl(null);
    }
    setCroppedAreaPixels(null);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
  };

  const onCropComplete = useCallback((_area, areaPixels) => {
    setCroppedAreaPixels(areaPixels);
  }, []);

  const applyCropAndUpload = async () => {
    if (!cropSourceUrl || !croppedAreaPixels) {
      toast.error('Adjust the image first.');
      return;
    }
    setUploading(true);
    try {
      let blob = await getCroppedImgBlob(cropSourceUrl, croppedAreaPixels, CROP_OUTPUT_SIZE, 0.88);
      if (blob.size > MAX_FILE_BYTES) {
        blob = await getCroppedImgBlob(cropSourceUrl, croppedAreaPixels, 280, 0.82);
      }
      if (blob.size > MAX_FILE_BYTES) {
        toast.error('Image is still too large after crop. Try a simpler photo or smaller original.');
        return;
      }
      const file = new File([blob], 'avatar.jpg', { type: 'image/jpeg' });
      const form = new FormData();
      form.append('avatar', file);
      await api.post('/auth/me/avatar', form);
      toast.success('Profile photo updated.');
      await onAvatarSaved();
      revokeCropUrl();
      onClose();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Could not process or upload the image.');
    } finally {
      setUploading(false);
    }
  };

  const onFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (!/^image\/(png|jpeg)$/i.test(file.type)) {
      toast.error('Please choose a PNG or JPEG image.');
      return;
    }
    if (file.size > Math.max(MAX_FILE_BYTES * 8, 1)) {
      toast.error('Original image is too large. Use a file smaller than ~3.5 MB.');
      return;
    }

    revokeCropUrl();
    const url = URL.createObjectURL(file);
    setCropSourceUrl(url);
    setCroppedAreaPixels(null);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
  };

  const cancelCrop = () => {
    revokeCropUrl();
  };

  const handleOverlayClose = () => {
    revokeCropUrl();
    onClose();
  };

  const clearAvatar = async () => {
    if (!window.confirm('Remove your profile photo?')) return;
    setUploading(true);
    try {
      await api.delete('/auth/me/avatar');
      toast.success('Profile photo removed.');
      await onAvatarSaved();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not remove photo.');
    } finally {
      setUploading(false);
    }
  };

  const avatarSrc = mediaUrl(user?.avatar);

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4">
      <div className="card w-full max-w-md shadow-xl relative">
        <button
          type="button"
          onClick={handleOverlayClose}
          className="absolute right-3 top-3 p-1 rounded-lg text-gray-400 hover:bg-gray-100 z-10"
          aria-label="Close"
        >
          <MdClose className="h-5 w-5" />
        </button>

        {cropSourceUrl ? (
          <div className="p-4 pt-12 pb-5">
            <p className="text-sm text-gray-600 text-center mb-3">
              Drag to center your face. Pinch or use the slider to zoom.
            </p>
            <div className="relative w-full h-72 rounded-xl overflow-hidden bg-gray-900">
              <Cropper
                image={cropSourceUrl}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                showGrid={false}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
              />
            </div>
            <div className="mt-4 px-1">
              <label className="flex items-center gap-3 text-xs text-gray-500">
                <span className="shrink-0 w-12">Zoom</span>
                <input
                  type="range"
                  min={1}
                  max={3}
                  step={0.01}
                  value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                  className="flex-1 h-2 accent-blue-600"
                />
              </label>
            </div>
            <div className="mt-5 flex flex-col-reverse sm:flex-row gap-2 justify-end">
              <button type="button" disabled={uploading} onClick={cancelCrop} className="btn-secondary">
                Cancel
              </button>
              <button
                type="button"
                disabled={uploading}
                onClick={() => applyCropAndUpload()}
                className="btn-primary inline-flex items-center justify-center gap-2"
              >
                {uploading ? <Spinner size="sm" /> : null}
                {uploading ? 'Saving…' : 'Save photo'}
              </button>
            </div>
          </div>
        ) : (
          <div className="px-8 pt-10 pb-6 text-center">
            <div className="mx-auto mb-5 h-28 w-28 rounded-full overflow-hidden bg-gray-100 ring-4 ring-white shadow-md">
              {avatarSrc ? (
                <img src={avatarSrc} alt="" className="h-full w-full object-cover object-center" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-blue-600 text-3xl font-bold uppercase text-white">
                  {user?.name?.[0] ?? '?'}
                </div>
              )}
            </div>
            <h2 className="text-lg font-semibold text-gray-900">{user?.name}</h2>
            <p className="text-sm text-gray-500 mt-0.5">{user?.email}</p>
            {user?.department ? (
              <p className="text-sm text-gray-600 mt-2">
                <span className="text-gray-400">Department</span>
                <br />
                <span className="font-medium">{user.department}</span>
              </p>
            ) : (
              <p className="text-xs text-gray-400 mt-2">No department on file</p>
            )}

            <input
              ref={inputRef}
              type="file"
              accept="image/png,image/jpeg,.png,.jpg,.jpeg"
              className="hidden"
              onChange={onFile}
            />

            <div className="mt-6 flex flex-col sm:flex-row gap-2 justify-center">
              <button
                type="button"
                disabled={uploading}
                onClick={() => inputRef.current?.click()}
                className="btn-primary inline-flex items-center justify-center gap-2"
              >
                {uploading ? <Spinner size="sm" /> : <MdPhotoCamera className="h-4 w-4" />}
                {uploading ? 'Saving…' : 'Upload photo (PNG / JPEG)'}
              </button>
              {user?.avatar && (
                <button type="button" disabled={uploading} onClick={clearAvatar} className="btn-secondary">
                  Remove photo
                </button>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-4">
              You can crop and center your photo before saving. Only your profile photo can be changed here.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfileModal;
