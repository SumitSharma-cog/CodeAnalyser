let uploadedFiles = {};

const progressContainer = document.getElementById('progress-container');
const progressBar = document.getElementById('progress-bar');

document.getElementById('zip-upload').addEventListener('change', function(e) {
  const file = e.target.files[0];
  if (!file) return;
  document.getElementById('status').textContent = 'Processing zip file...';

  // Show progress bar
  progressContainer.style.display = 'block';
  progressBar.style.width = '0%';

  // Read file with FileReader to show progress
  const reader = new FileReader();
  reader.onprogress = function(event) {
    if (event.lengthComputable) {
      const percent = Math.round((event.loaded / event.total) * 100);
      progressBar.style.width = percent + '%';
    }
  };
  reader.onload = function(event) {
    progressBar.style.width = '100%';
    // Now process zip with JSZip
    JSZip.loadAsync(event.target.result).then(zip => {
      uploadedFiles = {};
      let filePromises = [];
      zip.forEach((relativePath, zipEntry) => {
        if (
          zipEntry.name.endsWith('.js') || // React
          zipEntry.name.endsWith('.jsx') ||
          zipEntry.name.endsWith('.swift') ||
          zipEntry.name.endsWith('.m') || // Objective-C
          zipEntry.name.endsWith('.java')
        ) {
          filePromises.push(
            zipEntry.async('string').then(content => {
              uploadedFiles[zipEntry.name] = content;
            })
          );
        }
      });
      Promise.all(filePromises).then(() => {
        document.getElementById('status').textContent = 'Zip file ready for analysis!';
        setTimeout(() => {
          progressContainer.style.display = 'none';
          progressBar.style.width = '0%';
        }, 1000);
      });
    }).catch(() => {
      document.getElementById('status').textContent = 'Failed to read zip file.';
      progressContainer.style.display = 'none';
      progressBar.style.width = '0%';
    });
  };
  reader.onerror = function() {
    document.getElementById('status').textContent = 'Failed to read zip file.';
    progressContainer.style.display = 'none';
    progressBar.style.width = '0%';
  };
  reader.readAsArrayBuffer(file);
});

document.getElementById('analyze-btn').onclick = function() {
  if (Object.keys(uploadedFiles).length === 0) {
    document.getElementById('results').textContent = 'Please upload a zip file first.';
    return;
  }
  let report = [];
  Object.entries(uploadedFiles).forEach(([filename, content]) => {
    let lines = content.split('\n');
    lines.forEach((line, idx) => {
      // camelCase for function names (React/JS/Java/Swift)
      if (/function\s+([A-Z_][A-Z0-9_]+)/i.test(line) || /def\s+([A-Z_][A-Z0-9_]+)/i.test(line)) {
        report.push({
          file: filename,
          line: idx + 1,
          issue: 'Function name should be camelCase.'
        });
      }
      // Indentation (should be 2 or 4 spaces)
      if (/^\s+/.test(line) && !/^(\s{2}|\s{4})/.test(line)) {
        report.push({
          file: filename,
          line: idx + 1,
          issue: 'Indentation should be 2 or 4 spaces.'
        });
      }
      // Objective-C method naming
      if (filename.endsWith('.m') && /-\s*\((.*?)\)\s*([A-Z][A-Za-z0-9]*)/.test(line)) {
        report.push({
          file: filename,
          line: idx + 1,
          issue: 'Objective-C method name should start with lowercase.'
        });
      }
    });
  });

  // Render as table
  let resultsDiv = document.getElementById('results');
  if (report.length === 0) {
    resultsDiv.innerHTML = '<div><h2>No major formatting issues found!</h2></div>';
  } else {
    let tableHTML = `
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr>
            <th style="padding:8px;border:1px solid #ddd;">File</th>
            <th style="padding:8px;border:1px solid #ddd;">Line</th>
            <th style="padding:8px;border:1px solid #ddd;">Issue</th>
          </tr>
        </thead>
        <tbody>
          ${report.map(item => `
            <tr>
              <td style="padding:8px;border:1px solid #ddd;word-break:break-all;max-width:300px;">${item.file}</td>
              <td style="padding:8px;border:1px solid #ddd;">${item.line}</td>
              <td style="padding:8px;border:1px solid #ddd;">${item.issue}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
    resultsDiv.innerHTML = tableHTML;
  }

  // Download report as CSV
  document.getElementById('download-report').style.display = 'inline-block';
  document.getElementById('download-report').onclick = function() {
    let csv = 'File,Line,Issue\n' + report.map(item =>
      `"${item.file}",${item.line},"${item.issue.replace(/"/g, '""')}"`
    ).join('\n');
    const blob = new Blob([csv], {type: 'text/csv'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'code-style-report.csv';
    a.click();
    URL.revokeObjectURL(url);
  };
};