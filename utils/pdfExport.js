import { getDocs, collection, getDoc, doc } from 'firebase/firestore';
import { firestore } from '../config/firebaseconfig';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

export const exportSessionPDF = async (broadcastId) => {
  const broadcastDoc = await getDoc(doc(firestore, 'broadcasts', broadcastId));
  const broadcast = broadcastDoc.exists() ? broadcastDoc.data() : {};
  const timestamp = broadcast.createdAt?.toDate().toLocaleString() || 'N/A';
  const customId = broadcast.customId || broadcastId;
  const takenByName = broadcast.takenByName || broadcast.teacherFullName || 'N/A';

  const participantsSnapshot = await getDocs(collection(firestore, `broadcasts/${broadcastId}/participants`));
  const participants = participantsSnapshot.docs.map(d => d.data());

  const html = buildSessionHTML(customId, timestamp, takenByName, participants);
  const { uri } = await Print.printToFileAsync({ html });
  await Sharing.shareAsync(uri, {
    mimeType: 'application/pdf',
    dialogTitle: `${customId} Attendance`,
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
  const { uri } = await Print.printToFileAsync({ html });
  await Sharing.shareAsync(uri, {
    mimeType: 'application/pdf',
    dialogTitle: `${courseCode} - Full Attendance Report`,
    UTI: 'com.adobe.pdf',
  });
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

const buildCourseHTML = (courseCode, courseName, sessions) => `
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
    .session { margin-bottom: 24px; page-break-inside: avoid; }
    .session-header { background: #EFF6FC; padding: 12px 16px; border-radius: 8px 8px 0 0; border: 1px solid #EDEBE9; border-bottom: none; }
    .session-title { font-weight: 600; color: #0078D4; font-size: 14px; }
    .session-meta { color: #605E5C; font-size: 12px; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; }
    th { background-color: #FAF9F8; color: #242424; padding: 10px 8px; text-align: left; border: 1px solid #EDEBE9; font-weight: 600; font-size: 11px; }
    td { padding: 8px; border: 1px solid #EDEBE9; color: #605E5C; font-size: 11px; }
    tr:nth-child(even) { background-color: #FAF9F8; }
    .footer { margin-top: 30px; text-align: center; color: #A19F9D; font-size: 10px; }
  </style>
</head>
<body>
  <h1>${courseCode}</h1>
  <h2>${courseName}</h2>
  <div class="summary">
    <div class="summary-row">
      <span class="summary-label">Total Sessions</span>
      <span class="summary-value">${sessions.length}</span>
    </div>
    <div class="summary-row">
      <span class="summary-label">Total Attendance Records</span>
      <span class="summary-value">${sessions.reduce((sum, s) => sum + s.participantCount, 0)}</span>
    </div>
  </div>
  ${sessions.map(session => `
    <div class="session">
      <div class="session-header">
        <div class="session-title">${session.date}</div>
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
