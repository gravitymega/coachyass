/* ============================================================
   TALENT PERLÉ — Copie des inscriptions dans Google Sheets
   ============================================================
   Installation (une seule fois, par Karim ou l'utilisateur) :
   1) Créer un Google Sheet dans le Drive de Karim (ex. "Inscriptions Talent Perlé").
   2) Dans ce Sheet : Extensions → Apps Script.
   3) Effacer le code par défaut et coller tout le contenu de ce fichier.
   4) Déployer → Nouveau déploiement → type "Application Web" :
        - Exécuter en tant que : Moi
        - Qui a accès : Tout le monde
      → Déployer, autoriser les permissions demandées.
   5) Copier l'URL du déploiement (se termine par /exec) et la coller dans
      talent-perle-site/index.html, variable TP_SHEET_URL.
   Chaque inscription ajoute une ligne à la feuille active du Sheet. */

function doPost(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var data = JSON.parse(e.postData.contents);

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['Date', 'Nom du jeune', 'Âge', 'Activité', 'Joue déjà en équipe',
                      'Disponibilités', 'Parent / tuteur', 'Téléphone', 'Courriel']);
  }

  sheet.appendRow([
    new Date(),
    data.nom || '',
    data.age || '',
    data.activite || '',
    data.equipe || '',
    data.dispo || '',
    data.parent || '',
    data.telephone || '',
    data.courriel || ''
  ]);

  return ContentService.createTextOutput(JSON.stringify({ status: 'ok' }))
    .setMimeType(ContentService.MimeType.JSON);
}
