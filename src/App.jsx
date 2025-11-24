import React, { useEffect, useMemo, useState } from 'react';

const TABS = [
  { id: 'image', label: 'Image Processing' },
  { id: 'st', label: 'ST Processing' }
];

const defaultBanner = 'Select or create a profile to start working with baseline assets.';

const isFileSystemSupported = () => typeof window !== 'undefined' && 'showDirectoryPicker' in window;

async function getBaselineDirectory(profileHandle) {
  return await profileHandle.getDirectoryHandle('BaseLineImages', { create: true });
}

async function readBaselineImages(profileHandle) {
  const images = [];
  try {
    const dir = await profileHandle.getDirectoryHandle('BaseLineImages');
    for await (const entry of dir.values()) {
      if (entry.kind === 'file') {
        const file = await entry.getFile();
        images.push({ name: file.name, url: URL.createObjectURL(file) });
      }
    }
  } catch (error) {
    if (error?.name !== 'NotFoundError') {
      console.error('Unable to read baseline images', error);
    }
  }
  return images;
}

export default function App() {
  const [profileHandle, setProfileHandle] = useState(null);
  const [profileName, setProfileName] = useState('');
  const [profileNameInput, setProfileNameInput] = useState('');
  const [baselineImages, setBaselineImages] = useState([]);
  const [activeTab, setActiveTab] = useState(TABS[0].id);
  const [errorMessage, setErrorMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const supported = useMemo(() => isFileSystemSupported(), []);

  useEffect(() => () => baselineImages.forEach((img) => URL.revokeObjectURL(img.url)), [baselineImages]);

  const resetState = () => {
    setBaselineImages([]);
    setProfileHandle(null);
    setProfileName('');
    setProfileNameInput('');
    setErrorMessage('');
  };

  const setProfileContext = async (handle) => {
    setProfileHandle(handle);
    setProfileName(handle.name || 'Profile');
    const images = await readBaselineImages(handle);
    setBaselineImages(images);
  };

  const handleOpenProfile = async () => {
    if (!supported) return;
    try {
      setLoading(true);
      setErrorMessage('');
      const handle = await window.showDirectoryPicker();
      await setProfileContext(handle);
    } catch (error) {
      if (error?.name !== 'AbortError') {
        setErrorMessage('Unable to open profile. Please try again.');
        console.error(error);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProfile = async () => {
    if (!supported) return;
    if (!profileNameInput.trim()) {
      setErrorMessage('Please enter a profile name before creating.');
      return;
    }
    try {
      setLoading(true);
      setErrorMessage('');
      const parent = await window.showDirectoryPicker();
      const profile = await parent.getDirectoryHandle(profileNameInput.trim(), { create: true });
      await setProfileContext(profile);
      setProfileNameInput('');
    } catch (error) {
      if (error?.name !== 'AbortError') {
        setErrorMessage('Unable to create profile. Please try again.');
        console.error(error);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleImageSelection = async (event) => {
    if (!profileHandle) {
      setErrorMessage('Create or open a profile before selecting images.');
      return;
    }
    const files = Array.from(event.target.files || []).slice(0, 3);
    if (!files.length) return;
    try {
      setLoading(true);
      setErrorMessage('');
      const baselineDir = await getBaselineDirectory(profileHandle);
      for (const file of files) {
        const fileHandle = await baselineDir.getFileHandle(file.name, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(file);
        await writable.close();
      }
      const images = await readBaselineImages(profileHandle);
      setBaselineImages(images);
    } catch (error) {
      setErrorMessage('Unable to save baseline images. Please try again.');
      console.error(error);
    } finally {
      setLoading(false);
      event.target.value = '';
    }
  };

  const clearProfile = () => {
    resetState();
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <h1>Reactions Workspace</h1>
          <p className="subtitle">Profile-driven baseline image preparation</p>
        </div>
        <div className="header-actions">
          {profileHandle ? (
            <>
              <span className="profile-pill">{profileName}</span>
              <button className="ghost" type="button" onClick={clearProfile}>
                Switch Profile
              </button>
            </>
          ) : (
            <span className="profile-pill muted">No profile selected</span>
          )}
        </div>
      </header>

      {!supported && (
        <div className="banner warning">This browser does not support the File System Access API.</div>
      )}

      {!profileHandle && supported && (
        <div className="profile-modal">
          <div className="profile-card">
            <h2>Welcome</h2>
            <p className="modal-copy">Open an existing profile folder or create a new one.</p>
            <div className="modal-actions">
              <button type="button" onClick={handleOpenProfile} disabled={loading}>
                Open Profile Folder
              </button>
              <div className="create-row">
                <input
                  type="text"
                  placeholder="New profile name"
                  value={profileNameInput}
                  onChange={(event) => setProfileNameInput(event.target.value)}
                />
                <button type="button" onClick={handleCreateProfile} disabled={loading}>
                  Create Profile Folder
                </button>
              </div>
              <p className="note">A profile is stored as a folder on your local computer.</p>
            </div>
            {errorMessage && <div className="banner error">{errorMessage}</div>}
          </div>
        </div>
      )}

      <main className="content" aria-busy={loading}>
        <nav className="tabs" aria-label="Primary">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              className={tab.id === activeTab ? 'tab active' : 'tab'}
              type="button"
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {errorMessage && profileHandle && <div className="banner error">{errorMessage}</div>}

        {activeTab === 'image' && (
          <section className="panel">
            <header className="panel-header">
              <div>
                <h2>Baseline Images</h2>
                <p className="panel-copy">Select three required images to populate your baseline set.</p>
              </div>
              <div className="actions">
                <label className="file-button">
                  Choose Images
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleImageSelection}
                    disabled={!profileHandle || loading}
                  />
                </label>
              </div>
            </header>
            <div className="grid">
              {baselineImages.length === 0 && <p className="empty">{defaultBanner}</p>}
              {baselineImages.map((image) => (
                <figure key={image.name} className="image-card">
                  <img src={image.url} alt={image.name} />
                  <figcaption>{image.name}</figcaption>
                </figure>
              ))}
            </div>
          </section>
        )}

        {activeTab === 'st' && (
          <section className="panel">
            <header className="panel-header">
              <div>
                <h2>ST Processing</h2>
                <p className="panel-copy">Future processing tools will appear here.</p>
              </div>
            </header>
            <div className="empty">Profile-specific processing tools will be added soon.</div>
          </section>
        )}
      </main>
    </div>
  );
}
