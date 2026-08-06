import React, { useState } from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

function MockUploadCours() {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  const handleFileChange = (event) => {
    const selectedFile = event.target.files[0];
    if (selectedFile && selectedFile.type === 'application/pdf') {
      setFile(selectedFile);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    setUploading(false);
    setUploadSuccess(true);
    setFile(null);
  };

  return (
    <div data-testid="upload-page">
      <h2>Uploader un cours PDF</h2>
      
      <input
        type="file"
        accept=".pdf"
        onChange={handleFileChange}
        data-testid="file-input"
      />
      
      {file && (
        <div data-testid="file-info">
          <p>Fichier sélectionné: {file.name}</p>
          <p>Taille: {(file.size / 1024 / 1024).toFixed(2)} MB</p>
        </div>
      )}

      <button
        onClick={handleUpload}
        disabled={!file || uploading}
        data-testid="upload-button"
      >
        {uploading ? 'Upload en cours...' : 'Uploader le cours'}
      </button>

      {uploadSuccess && (
        <div data-testid="success-message" style={{ color: 'green' }}>
          ✅ Cours uploadé avec succès!
        </div>
      )}
    </div>
  );
}

describe('Upload de Fichier PDF', () => {
  test('processus complet d\'upload de PDF', async () => {
    const user = userEvent.setup();
    
    render(<MockUploadCours />);

    expect(screen.getByTestId('upload-page')).toBeInTheDocument();
    expect(screen.getByText('Uploader un cours PDF')).toBeInTheDocument();

    const file = new File(['fake pdf content'], 'cours-cardio.pdf', { 
      type: 'application/pdf' 
    });

    const fileInput = screen.getByTestId('file-input');
    await user.upload(fileInput, file);

    await waitFor(() => {
      expect(screen.getByTestId('file-info')).toBeInTheDocument();
      expect(screen.getByText('Fichier sélectionné: cours-cardio.pdf')).toBeInTheDocument();
    });

    const uploadButton = screen.getByTestId('upload-button');
    expect(uploadButton).not.toBeDisabled();

    await user.click(uploadButton);

    expect(screen.getByText('Upload en cours...')).toBeInTheDocument();
    expect(uploadButton).toBeDisabled();

    await waitFor(() => {
      expect(screen.getByTestId('success-message')).toBeInTheDocument();
    }, { timeout: 2000 });

    expect(screen.getByText('✅ Cours uploadé avec succès!')).toBeInTheDocument();
  });

  test('validation du type de fichier', async () => {
    const user = userEvent.setup();
    
    render(<MockUploadCours />);

    const txtFile = new File(['text content'], 'document.txt', { 
      type: 'text/plain' 
    });

    const fileInput = screen.getByTestId('file-input');
    await user.upload(fileInput, txtFile);

    expect(screen.queryByTestId('file-info')).not.toBeInTheDocument();

    const uploadButton = screen.getByTestId('upload-button');
    expect(uploadButton).toBeDisabled();
  });
});