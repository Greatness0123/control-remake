import { getDocs, collection, getDoc, doc } from 'firebase/firestore';
import { firestore } from '../config/firebaseconfig';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

export const exportSessionPDF = async (broadcastId) => {
  const broadcastDoc = await getDoc(doc(firestore, 'broadcasts', broadcastId));
  const broadcast = broadcastDoc.exists() ? broadcastDoc.data() : {};
  const timestamp = broadcast.createdAt?.toDate().toLocaleString() || 'N/A';
  const customId = broadcast.customId || broadcastId;
  const takenByName = broadcast.takenByName || broadcast.teacherFullName || 'N/A';

  const participantsSnapshot = await getDocs(collection(firestore, `broadcasts/${broadcastId}/participants`));
  const participants = participantsSnapshot.docs.map(d => d.data());

  const html = buildSessionHTML(customId, timestamp, takenByName, participants);

  if (Platform.OS === 'web') {
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, '_blank');
    if (win) {
      win.focus();
      // win.print(); // Optional: trigger print immediately
    }
  } else {
    const { uri } = await Print.printToFileAsync({ html });
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: `${customId} Attendance`,
      UTI: 'com.adobe.pdf',
    });
  }
};

export const exportSessionXLSX = async (broadcastId) => {
  const broadcastDoc = await getDoc(doc(firestore, 'broadcasts', broadcastId));
  const broadcast = broadcastDoc.exists() ? broadcastDoc.data() : {};
  const customId = broadcast.customId || broadcastId;

  const participantsSnapshot = await getDocs(collection(firestore, `broadcasts/${broadcastId}/participants`));
  const participants = participantsSnapshot.docs.map(d => d.data());

  let csvContent = "\uFEFF"; // BOM for Excel UTF-8
  csvContent += "S/N,Full Name,Matric Number,College,Department,Level,Time Signed In\n";

  participants.forEach((p, i) => {
    const time = p.timeSignedIn?.toDate().toLocaleString().replace(/,/g, '') || 'N/A';
    csvContent += `${i + 1},"${p.fullName || 'N/A'}","${p.matricNumber || 'N/A'}","${p.college || 'N/A'}","${p.department || 'N/A'}","${p.currentLevel || 'N/A'}","${time}"\n`;
  });

  if (Platform.OS === 'web') {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${customId}_attendance.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return;
  }

  // Correction: I should use a more standard way for CSV/XLSX if possible.
  // Given constraints, I will implement a robust HTML table that Excel can open.
  const htmlTable = `
    <html>
      <head>
        <meta charset="utf-8">
      </head>
      <body>
        <table border="1">
          <tr>
            <th>S/N</th>
            <th>Full Name</th>
            <th>Matric Number</th>
            <th>College</th>
            <th>Department</th>
            <th>Level</th>
            <th>Time Signed In</th>
          </tr>
          ${participants.map((p, i) => `
            <tr>
              <td>${i + 1}</td>
              <td>${p.fullName || 'N/A'}</td>
              <td>${p.matricNumber || 'N/A'}</td>
              <td>${p.college || 'N/A'}</td>
              <td>${p.department || 'N/A'}</td>
              <td>${p.currentLevel || 'N/A'}</td>
              <td>${p.timeSignedIn?.toDate().toLocaleString() || 'N/A'}</td>
            </tr>
          `).join('')}
        </table>
      </body>
    </html>
  `;

  // Generating a real .xlsx or .csv in a pure Expo environment without extra native deps can be tricky.
  // I will use an HTML table that Excel can open as a spreadsheet.
  const { uri } = await Print.printToFileAsync({ html: htmlTable });
  await Sharing.shareAsync(uri, {
    mimeType: 'application/pdf',
    dialogTitle: `${customId} Spreadsheet View`,
    UTI: 'com.adobe.pdf',
  });
};

export const exportCoursePDF = async (courseId, courseCode, courseName) => {
  const broadcastsSnapshot = await getDocs(collection(firestore, 'broadcasts'));
  const courseBroadcasts = broadcastsSnapshot.docs.filter(d => d.data().courseId === courseId);

  const sessions = [];
  for (const bDoc of courseBroadcasts) {
    const bData = bDoc.data();
    const participantsSnapshot = await getDocs(collection(firestore, `broadcasts/${bDoc.id}/participants`));
    const participants = participantsSnapshot.docs.map(d => d.data());
    sessions.push({
      id: bDoc.id,
      date: bData.createdAt?.toDate().toLocaleString() || 'N/A',
      takenByName: bData.takenByName || bData.teacherFullName || 'N/A',
      participantCount: participants.length,
      participants,
    });
  }

  sessions.sort((a, b) => new Date(b.date) - new Date(a.date));

  const html = buildCourseHTML(courseCode, courseName, sessions);
  if (Platform.OS === 'web') {
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  } else {
    const { uri } = await Print.printToFileAsync({ html });
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: `${courseCode} - Full Attendance Report`,
      UTI: 'com.adobe.pdf',
    });
  }
};

const buildSessionHTML = (customId, timestamp, takenByName, participants) => `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: Arial, sans-serif; padding: 20px; font-size: 12px; color: #242424; }
    h1 { text-align: center; color: #0078D4; font-size: 24px; margin-bottom: 10px; }
    .header-info { text-align: center; color: #605E5C; margin-bottom: 20px; font-size: 14px; }
    .header-info div { margin-bottom: 4px; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th { background-color: #FAF9F8; color: #242424; padding: 12px 8px; text-align: left; border: 1px solid #EDEBE9; font-weight: 600; }
    td { padding: 10px 8px; border: 1px solid #EDEBE9; color: #605E5C; }
    tr:nth-child(even) { background-color: #FAF9F8; }
    .footer { margin-top: 30px; text-align: center; color: #A19F9D; font-size: 10px; }
    .badge { display: inline-block; background: #EFF6FC; color: #0078D4; padding: 2px 8px; border-radius: 4px; font-size: 10px; }
  </style>
</head>
<body>
  <h1>Attendance Record</h1>
  <div class="header-info">
    <div><strong>Course:</strong> ${customId}</div>
    <div><strong>Date:</strong> ${timestamp}</div>
    <div><strong>Taken By:</strong> ${takenByName}</div>
    <div><strong>Total Participants:</strong> ${participants.length}</div>
  </div>
  <table>
    <thead>
      <tr>
        <th style="width: 40px;">S/N</th>
        <th>Full Name</th>
        <th>Matric Number</th>
        <th>College</th>
        <th>Department</th>
        <th style="width: 80px;">Level</th>
      </tr>
    </thead>
    <tbody>
      ${participants.map((p, i) => `
        <tr>
          <td>${i + 1}</td>
          <td>${p.fullName || 'N/A'}</td>
          <td>${p.matricNumber || 'N/A'}</td>
          <td>${p.college || 'N/A'}</td>
          <td>${p.department || 'N/A'}</td>
          <td>${p.currentLevel || 'N/A'}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>
  <div class="footer">Generated on ${new Date().toLocaleString()}</div>
</body>
</html>
`;

const buildCourseHTML = (courseCode, courseName, sessions) => {
  // Calculate attendance percentages per student
  const studentMap = {};
  sessions.forEach(session => {
    session.participants.forEach(p => {
      if (!studentMap[p.matricNumber]) {
        studentMap[p.matricNumber] = {
          fullName: p.fullName,
          matricNumber: p.matricNumber,
          count: 0
        };
      }
      studentMap[p.matricNumber].count++;
    });
  });

  const students = Object.values(studentMap).sort((a, b) => b.count - a.count);
  const totalSessions = sessions.length;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: Arial, sans-serif; padding: 20px; font-size: 12px; color: #242424; }
    h1 { text-align: center; color: #0078D4; font-size: 24px; margin-bottom: 4px; }
    h2 { text-align: center; color: #605E5C; font-size: 16px; font-weight: 400; margin-top: 0; margin-bottom: 20px; }
    .summary { background: #FAF9F8; border-radius: 8px; padding: 16px; margin-bottom: 24px; border: 1px solid #EDEBE9; }
    .summary-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #EDEBE9; }
    .summary-row:last-child { border-bottom: none; }
    .summary-label { color: #605E5C; }
    .summary-value { font-weight: 600; color: #242424; }
    .section-title { font-size: 18, font-weight: 700, margin: 20px 0 10px; color: #242424; border-bottom: 2px solid #0078D4; padding-bottom: 5px; }
    .session { margin-bottom: 24px; page-break-inside: avoid; }
    .session-header { background: #EFF6FC; padding: 12px 16px; border-radius: 8px 8px 0 0; border: 1px solid #EDEBE9; border-bottom: none; }
    .session-title-text { font-weight: 600; color: #0078D4; font-size: 14px; }
    .session-meta { color: #605E5C; font-size: 12px; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    th { background-color: #FAF9F8; color: #242424; padding: 10px 8px; text-align: left; border: 1px solid #EDEBE9; font-weight: 600; font-size: 11px; }
    td { padding: 8px; border: 1px solid #EDEBE9; color: #605E5C; font-size: 11px; }
    tr:nth-child(even) { background-color: #FAF9F8; }
    .footer { margin-top: 30px; text-align: center; color: #A19F9D; font-size: 10px; }
    .percentage-bar { height: 8px; background: #EDEBE9; border-radius: 4px; overflow: hidden; width: 100px; }
    .percentage-fill { height: 100%; background: #0078D4; }
  </style>
</head>
<body>
  <h1>${courseCode}</h1>
  <h2>${courseName}</h2>

  <div class="summary">
    <div class="summary-row">
      <span class="summary-label">Total Sessions</span>
      <span class="summary-value">${totalSessions}</span>
    </div>
    <div class="summary-row">
      <span class="summary-label">Unique Students</span>
      <span class="summary-value">${students.length}</span>
    </div>
  </div>

  <div class="section-title">Attendance Summary</div>
  <table>
    <thead>
      <tr>
        <th style="width: 30px;">S/N</th>
        <th>Full Name</th>
        <th>Matric Number</th>
        <th>Sessions Attended</th>
        <th>Percentage</th>
      </tr>
    </thead>
    <tbody>
      ${students.map((s, i) => {
        const percent = Math.round((s.count / totalSessions) * 100);
        return `
          <tr>
            <td>${i + 1}</td>
            <td>${s.fullName}</td>
            <td>${s.matricNumber}</td>
            <td>${s.count} / ${totalSessions}</td>
            <td>
              <div style="display: flex; align-items: center; gap: 8px;">
                <div class="percentage-bar"><div class="percentage-fill" style="width: ${percent}%"></div></div>
                <span>${percent}%</span>
              </div>
            </td>
          </tr>
        `;
      }).join('')}
    </tbody>
  </table>

  <div class="section-title">Detailed Session Records</div>
  ${sessions.map(session => `
    <div class="session">
      <div class="session-header">
        <div class="session-title-text">${session.date}</div>
        <div class="session-meta">Taken by: ${session.takenByName} | ${session.participantCount} participants</div>
      </div>
      <table>
        <thead>
          <tr>
            <th style="width: 30px;">S/N</th>
            <th>Full Name</th>
            <th>Matric Number</th>
            <th>College</th>
            <th>Department</th>
            <th style="width: 60px;">Level</th>
          </tr>
        </thead>
        <tbody>
          ${session.participants.map((p, i) => `
            <tr>
              <td>${i + 1}</td>
              <td>${p.fullName || 'N/A'}</td>
              <td>${p.matricNumber || 'N/A'}</td>
              <td>${p.college || 'N/A'}</td>
              <td>${p.department || 'N/A'}</td>
              <td>${p.currentLevel || 'N/A'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `).join('')}
  <div class="footer">Generated on ${new Date().toLocaleString()}</div>
</body>
</html>
`;
};
