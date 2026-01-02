'use client';

import { ChangeEvent, useCallback, useMemo, useState } from 'react';
import type { SolveResult } from '@/lib/solver';
import { solveSapMMTicket } from '@/lib/solver';

type UploadStatus = 'idle' | 'ocr' | 'analysis' | 'done' | 'error';

export default function HomePage() {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [extractedText, setExtractedText] = useState<string>('');
  const [status, setStatus] = useState<UploadStatus>('idle');
  const [progress, setProgress] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [solution, setSolution] = useState<SolveResult | null>(null);
  const [processingTime, setProcessingTime] = useState<number | null>(null);

  const handleFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      setFileName(file.name);
      setImagePreview(URL.createObjectURL(file));
      setStatus('ocr');
      setProgress(0.05);
      setError(null);
      setSolution(null);
      setProcessingTime(null);

      const start = performance.now();
      try {
        const Tesseract = await import('tesseract.js');
        const { data } = await Tesseract.recognize(file, 'eng', {
          logger: (message) => {
            if (message.status === 'recognizing text' && typeof message.progress === 'number') {
              setProgress(Math.max(0.05, Math.min(0.9, message.progress)));
            }
          }
        });

        const cleanedText = data.text.trim();
        setExtractedText(cleanedText);
        setProgress(0.92);
        setStatus('analysis');

        const result = solveSapMMTicket(cleanedText);
        setSolution(result);
        setStatus('done');
        setProgress(1);
        setProcessingTime(performance.now() - start);
      } catch (err) {
        console.error(err);
        setStatus('error');
        setError('Unable to process the image. Please try another photo or check the file format.');
      }
    },
    []
  );

  const handleAnalyzeText = useCallback(() => {
    setStatus('analysis');
    setProgress(0.6);
    const start = performance.now();
    const result = solveSapMMTicket(extractedText);
    setSolution(result);
    setStatus('done');
    setProgress(1);
    setProcessingTime(performance.now() - start);
  }, [extractedText]);

  const statusLabel = useMemo(() => {
    switch (status) {
      case 'ocr':
        return 'Reading ticket details...';
      case 'analysis':
        return 'Building SAP MM resolution plan...';
      case 'done':
        return 'Resolution plan ready';
      case 'error':
        return 'Processing failed';
      default:
        return 'Waiting for ticket photo';
    }
  }, [status]);

  return (
    <div className="app-shell">
      <section className="card">
        <header>
          <h1 className="card-title">SAP MM Ticket Solver</h1>
          <p className="card-subtitle">
            Upload a ticket screenshot. The assistant extracts the details and generates a guided
            step-by-step resolution tailored to SAP Materials Management.
          </p>
        </header>

        <label className="dropzone">
          <input
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/heic,image/heif,application/pdf"
            onChange={handleFileChange}
          />
          <div className="dropzone-icon" aria-hidden>📷</div>
          <div className="dropzone-text">
            {fileName ? `Replace ticket image (${fileName})` : 'Drop ticket photo or click to upload'}
          </div>
          <div className="dropzone-hint">
            Supported: JPG, PNG, HEIC, PDF. High-contrast screenshots deliver the best OCR results.
          </div>
        </label>

        {imagePreview && (
          <div className="panel">
            <h3>Ticket Snapshot</h3>
            <img src={imagePreview} alt="Ticket preview" className="preview-image" />
          </div>
        )}

        <div className={`status-chip ${status === 'error' ? 'error' : status === 'done' ? 'success' : ''}`}>
          <span>{statusLabel}</span>
          {status !== 'idle' && status !== 'error' && status !== 'done' && (
            <small>{Math.round(progress * 100)}%</small>
          )}
        </div>

        {status !== 'idle' && status !== 'error' && (
          <div className="progress-track" role="progressbar" aria-valuenow={progress * 100}>
            <div className="progress-value" style={{ width: `${Math.max(progress * 100, 8)}%` }} />
          </div>
        )}

        {error && <div className="panel">{error}</div>}

        <div className="two-column">
          <article className="panel">
            <h3>Extracted Ticket Text</h3>
            <p>
              Review and adjust the detected ticket details. Refining the text helps the solver
              deliver the most precise resolution steps.
            </p>
            <textarea
              placeholder="Ticket text will appear here after OCR..."
              value={extractedText}
              onChange={(event) => setExtractedText(event.target.value)}
            />
            <button
              type="button"
              onClick={handleAnalyzeText}
              disabled={!extractedText}
              style={{
                alignSelf: 'flex-start',
                background: '#1d4ed8',
                color: '#fff',
                border: 'none',
                borderRadius: '12px',
                padding: '0.75rem 1.4rem',
                fontWeight: 600,
                cursor: extractedText ? 'pointer' : 'not-allowed',
                opacity: extractedText ? 1 : 0.5,
                transition: 'transform 0.2s ease'
              }}
            >
              Re-run Analysis
            </button>
            {processingTime && (
              <small style={{ color: '#64748b' }}>
                Latest analysis completed in {(processingTime / 1000).toFixed(1)} seconds.
              </small>
            )}
          </article>

          <article className="panel">
            <h3>Resolution Plan</h3>
            {solution ? (
              <div style={{ display: 'grid', gap: '0.75rem' }}>
                <div className="metadata-grid">
                  <div className="metadata-item">
                    <strong>Scenario</strong>
                    <span>{solution.title}</span>
                  </div>
                  <div className="metadata-item">
                    <strong>Confidence</strong>
                    <span>{Math.round(solution.confidence * 100)}%</span>
                  </div>
                  <div className="metadata-item">
                    <strong>Module Focus</strong>
                    <span>{solution.metadata.suspectedModule}</span>
                  </div>
                  {solution.metadata.priority && (
                    <div className="metadata-item">
                      <strong>Priority</strong>
                      <span>{solution.metadata.priority}</span>
                    </div>
                  )}
                </div>

                <p>{solution.summary}</p>

                <div>
                  <strong>Root Cause Hypothesis</strong>
                  <p>{solution.rootCause}</p>
                </div>

                <div>
                  <strong>Guided Steps</strong>
                  <ol className="solutions-list">
                    {solution.steps.map((step, index) => (
                      <li key={index}>{step}</li>
                    ))}
                  </ol>
                </div>

                <div>
                  <strong>Validation Checks</strong>
                  <ul className="solutions-list">
                    {solution.validations.map((item, index) => (
                      <li key={`validation-${index}`}>{item}</li>
                    ))}
                  </ul>
                </div>

                <div>
                  <strong>Preventive Actions</strong>
                  <ul className="solutions-list">
                    {solution.preventiveActions.map((item, index) => (
                      <li key={`preventive-${index}`}>{item}</li>
                    ))}
                  </ul>
                </div>

                <div>
                  <strong>Automation / Analytics Ideas</strong>
                  <ul className="solutions-list">
                    {solution.automationIdeas.map((item, index) => (
                      <li key={`automation-${index}`}>{item}</li>
                    ))}
                  </ul>
                </div>

                <div>
                  <strong>Knowledge Sources</strong>
                  <ul className="solutions-list">
                    {solution.knowledgeSources.map((source, index) => (
                      <li key={`source-${index}`}>{source}</li>
                    ))}
                  </ul>
                </div>

                {solution.metadata.keywords.length > 0 && (
                  <div>
                    <strong>Detected Keywords</strong>
                    <div className="solutions-list">
                      <span>{solution.metadata.keywords.join(', ')}</span>
                    </div>
                  </div>
                )}

                {solution.metadata.documentNumbers.length > 0 && (
                  <div>
                    <strong>Document References</strong>
                    <div className="solutions-list">
                      <span>{solution.metadata.documentNumbers.join(', ')}</span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p>
                Upload a ticket and the assistant will generate a resolution playbook based on the
                extracted SAP MM context.
              </p>
            )}
          </article>
        </div>

        <footer className="footer">
          Built for SAP MM support teams. Works entirely in-browser—no ticket data leaves your
          device.
        </footer>
      </section>
    </div>
  );
}
