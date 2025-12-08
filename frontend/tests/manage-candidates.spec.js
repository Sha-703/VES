const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

function unique() {
  return `e2e${Date.now()}`;
}

test('E2E — add, edit and delete candidate with photo', async ({ page, request }) => {
  // This test expects backend running on :8000 and frontend dev server on :5173

  // 1) Register institution via UI
  const id = unique();
  await page.goto('/institution/register');
  await page.fill('input[name="username"]', id);
  await page.fill('input[name="email"]', `${id}@example.test`);
  await page.fill('input[name="password"]', 'supersecret');
  await page.fill('input[name="institution_name"]', `E2E Institution ${id}`);
  await page.click('button[type="submit"]');

  // Should navigate to dashboard
  await page.waitForURL('**/institution/dashboard');

  // 2) Create an election
  await page.click('button:has-text("+ Créer une élection")');
  await page.fill('input[placeholder="Titre :"], input[name="title"]', 'E2E Election');
  await page.fill('textarea[name="description"]', 'Test election created by e2e');
  await page.click('button:has-text("Créer")');
  // Wait for list update
  await page.waitForSelector('a:has-text("Gérer →")');

  // Navigate to manage election page
  const link = await page.$('a:has-text("Gérer →")');
  await link.click();
  await page.waitForURL('**/institution/election/*');

  // 3) Create a ballot (legacy wording) — create the election window
  await page.fill('input[type="text"]', 'Scrutin E2E');
  const start = new Date(Date.now() + 1000 * 60 * 60).toISOString().slice(0, 16);
  const end = new Date(Date.now() + 1000 * 60 * 60 * 2).toISOString().slice(0, 16);
  // Find proper inputs (datetime-local)
  await page.fill('input[type="datetime-local"]', start);
  // second datetime-local
  const inputs = await page.$$('input[type="datetime-local"]');
  if (inputs.length >= 2) await inputs[1].fill(end);
  await page.click('button:has-text("Créer")');

  // 4) Go to ManageCandidates page (dedicated)
  const url = page.url();
  // extract election id from url
  const electionMatch = url.match(/election\/(\d+)/);
  expect(electionMatch).not.toBeNull();
  const electionId = electionMatch[1];
  await page.goto(`/institution/election/${electionId}/candidates`);

  // prepare temp image
  const tmpDir = path.join(process.cwd(), 'tests', 'tmp');
  fs.mkdirSync(tmpDir, { recursive: true });
  const imgPath = path.join(tmpDir, 'photo.png');
  // 1x1 PNG
  const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGMAAQAABQABDQottAAAAABJRU5ErkJggg==';
  fs.writeFileSync(imgPath, Buffer.from(pngBase64, 'base64'));

  // 5) Add candidate
  // open the add-candidate panel
  await page.click('button:has-text("Ajouter / gérer candidats")');
  // fill form
  await page.fill('input[placeholder="Nom complet"]', 'Jean Dupont');
  await page.fill('input[placeholder^="Poste"]', 'Président');
  await page.fill('textarea[placeholder="Brève description"]', 'Test candidate');
  await page.setInputFiles('input[type="file"]', imgPath);
  await page.click('button:has-text("Ajouter")');

  // candidate should appear
  await page.waitForSelector('text=Jean Dupont');

  // 6) Edit candidate - change name
  await page.click('button:has-text("✏️")');
  await page.fill('input[placeholder="Nom complet"]', 'Jean Dupont modifié');
  await page.click('button:has-text("Mettre à jour")');
  await page.waitForSelector('text=Jean Dupont modifié');

  // 7) Delete candidate (modal confirmation)
  await page.click('button:has-text("🗑️")');
  // wait for the modal and confirm
  await page.waitForSelector('text=Confirmer la suppression');
  await page.click('button:has-text("Supprimer")');
  // ensure removed
  await expect(page.locator('text=Jean Dupont modifié')).toHaveCount(0);
});
