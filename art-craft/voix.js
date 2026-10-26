// Studio voix : voix françaises gratuites Piper, générées dans le navigateur (piper.js).
import { $, showError, setProgress, offerFile } from './common.js';
import { BRAND } from './brand.js';
import { FREE_VOICES, DEFAULT_FREE_VOICE } from './piper-core.js';
import { speakFree } from './piper.js';

// Modèles de textes Gravity (point de départ, à adapter).
const TEMPLATES = {
  intro: `Voici les meilleurs moments du dernier match de ${BRAND.name}. Accroche-toi, ça part fort !`,
  match: `Game day ! ${BRAND.name} affronte [adversaire] ce [jour] à [heure], au [lieu]. Viens nous encourager, l'entrée est gratuite. On compte sur toi !`,
  inscription: `Les inscriptions ${BRAND.name} sont ouvertes ! Entraînements, matchs et coaching pour tous les niveaux à ${BRAND.city}. Places limitées : inscris-toi maintenant sur ${BRAND.site.replace(/\./g, ' point ')}.`,
  merci: `Merci aux joueurs, aux parents, aux coachs et à tous nos partenaires. Suivez-nous sur Instagram, ${BRAND.instagram.replace('@', 'arobase ').replace(/_/g, ' ')}, et on se voit au prochain match. Gravity, on monte !`,
};

FREE_VOICES.forEach(v => $('voice').appendChild(new Option(v.name, v.id)));
$('voice').value = DEFAULT_FREE_VOICE;

document.querySelectorAll('[data-tpl]').forEach(b => b.addEventListener('click', () => {
  $('text').value = TEMPLATES[b.dataset.tpl];
  $('text').dispatchEvent(new Event('input'));
}));
$('text').addEventListener('input', () => { $('chars').textContent = `${$('text').value.length} / 5000 caractères`; });

$('btn-speak').onclick = async () => {
  const text = $('text').value.trim();
  if (!text) { showError('Écris un texte.'); return; }
  showError('');
  $('result').hidden = true;
  $('btn-speak').disabled = true;
  try {
    const wav = await speakFree(text, $('voice').value, {
      speed: +$('speed').value, onProgress: (r, label) => setProgress('speak-progress', r, label),
    });
    const label = ($('voice').selectedOptions[0]?.text || 'gravity').toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const url = offerFile(wav, `voix-${label}.wav`, { download: 'btn-download', share: 'btn-share', title: 'Voix off Gravity' });
    $('result-audio').src = url;
    $('result').hidden = false;
    setProgress('speak-progress', 1, `Voix prête · ${(wav.size / 1e6).toFixed(1)} Mo`);
  } catch (err) {
    showError('Génération impossible : ' + err.message);
  } finally {
    $('btn-speak').disabled = false;
  }
};
