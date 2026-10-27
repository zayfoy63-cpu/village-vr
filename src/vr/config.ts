// Tous les réglages de la version VR / réalité mixte (Meta Quest 3).
// Les distances sont en mètres réels, les durées en secondes réelles sauf mention contraire.

export const VR_CONFIG = {
  /** Plateau : taille réelle (1 case du jeu = `scale` mètre) et limites du zoom */
  board: {
    scale: 0.05,
    minScale: 0.025,
    maxScale: 0.09,
    /** Pas de zoom au joystick (par seconde, multiplicatif) */
    zoomSpeed: 0.8,
    /** Rotation au joystick (rad/s) */
    turnSpeed: 1.6,
    /** Plateau présenté au lancement (ou recentré) : distance devant le joueur (m), hauteur de la taille
     *  sous les yeux (m), bornes de hauteur, inclinaison vers le joueur au lancement (rad) */
    frontDistance: 0.6,
    waistBelowEyes: 0.6,
    frontHeightMin: 0.6,
    frontHeightMax: 1.15,
    presentTilt: 0.26,
    /** Montée / descente du plateau au joystick (m/s) et bornes de hauteur relative au sol (m) */
    liftSpeed: 0.3,
    minHeight: 0.4,
    maxHeight: 1.4,
  },

  /** Saisie du plateau par ses bords (mains : pincement ; manettes : grip) */
  grab: {
    /** Distance maximale à l'extérieur du bord pour saisir (m) */
    reach: 0.07,
    /** Profondeur à l'intérieur du bord qui compte encore comme « bord » (m) */
    inside: 0.04,
    /** Écart vertical maximal entre la main et le dessus du plateau (m) */
    height: 0.1,
    /** La surbrillance d'un bord commence à cette distance (m) */
    glowFrom: 0.16,
    /** Pincement : doigts à moins de `pinchOn` = pincé, relâché au-delà de `pinchOff` (m) */
    pinchOn: 0.02,
    pinchOff: 0.045,
    /** Lissage du mouvement (1/s, plus grand = plus vif) : une main, deux mains (très stable) */
    smoothOne: 22,
    smoothTwo: 12,
    /** Zoom à deux mains : pincements au-dessus du plateau, jusqu'à cette hauteur au-dessus des cases (m) */
    zoomHeight: 0.35,
  },

  /** Pose sur la vraie table (plans détectés et hit-test) */
  snap: {
    /** Relâché à moins de `above` au-dessus d'une surface (ou `below` en dessous) : aimanté dessus (m) */
    above: 0.16,
    below: 0.06,
    /** Durée de l'aimantation (s) et petit rebond (m) */
    duration: 0.3,
    bounce: 0.006,
    /** Sondage de la surface sous le plateau pendant la saisie (s entre deux sondages) */
    probeEvery: 0.15,
    /** Une surface non revue depuis ce délai est oubliée (s) */
    forgetAfter: 1.2,
    /** Ombre du plateau sur la table : opacité au contact et hauteur où elle s'efface (m) */
    shadowOpacity: 0.45,
    shadowFade: 0.6,
  },

  /** Interface autour du plateau (en mètres, repère du plateau non mis à l'échelle) */
  ui: {
    /** Espace entre le bord du plateau et les éléments posés autour */
    margin: 0.06,
    /** Inclinaison des panneaux vers le joueur (rad) : 0 = verticaux */
    tilt: 0.35,
    /** Taille de texte de base (m) */
    text: 0.032,
    /** Facteur d'agrandissement d'un élément interactif sous le pointeur */
    hoverGrow: 1.08,
    /** Zone de tolérance supplémentaire autour des éléments interactifs en mode mains (m) */
    handPadding: 0.012,
    /** Délai avant fermeture d'un panneau qu'on ne regarde plus (s) */
    panelAutoCloseSec: 4,
    /** Durée d'affichage d'une bulle de notification (s) */
    bubbleSec: 6,
    /** Cartes d'événements : largeur (m) */
    cardWidth: 0.44,
  },

  /** Interactions */
  interact: {
    /** Un appui plus court que ça est un « clic » (ms) : généreux pour le pincement des mains */
    clickMs: 450,
    /** Pincement / gâchette : rayon de saisie autour du pointeur (m) */
    grabRadius: 0.05,
    /** Décalage vertical d'un bâtiment tenu en main au-dessus de la table (m) */
    holdLift: 0.07,
    /** Taille d'un bâtiment miniature dans la boîte (m) et agrandissement quand on le survole */
    miniSize: 0.078,
    /** Appui du doigt : distance de déclenchement (m) */
    touchDown: 0.012,
    /** Déplacement maximal du bout du doigt entre l'appui et le retrait pour compter un tap (m) */
    tapSlop: 0.2,
    /** Éclaireur / bandit : zone de saisie (m) */
    banditGrab: 0.08,
  },

  /** Déplacer et détruire */
  moves: {
    /** Déplacement gratuit pendant ce délai après la pose (secondes de jeu à vitesse x1) */
    freeSeconds: 20,
    /** Sinon : part du coût de construction, minimum d'une unité */
    costRatio: 0.15,
    /** Part rendue en détruisant (coût cumulé des niveaux) */
    refundRatio: 0.5,
    /** Durée pendant laquelle « Annuler » reste possible (secondes réelles) */
    undoSeconds: 30,
  },

  /** Confort */
  comfort: {
    /** Pause automatique casque retiré / session quittée */
    pauseOnHidden: true,
    /** Les mains sont considérées perdues après ce délai sans suivi (s) */
    handsLostAfterSec: 2.5,
  },

  /** Performance (Quest 3 : viser 72 images/s) */
  perf: {
    targetFps: 72,
    /** Résolution du rendu (1 = native) et lissage fovéal */
    frameBufferScaling: 0.9,
    foveation: 0.6,
    /** Particules : nombre maximum en VR (pluie, neige) */
    rainDrops: 120,
    snowFlakes: 90,
    /** Fumée : bouffées par cheminée et cheminées qui fument au plus ; escarbilles et poussière */
    smokePuffs: 3,
    smokeChimneys: 30,
    sparks: 50,
    dust: 24,
    /** Taille de la carte d'ombre en VR (0 = pas d'ombre) ; une seule lumière projette des ombres */
    shadowMap: 1024,
    /** Demi-étendue de la zone d'ombre en VR (unités du jeu, repère de la lumière) : le plateau seul */
    shadowExtent: { x: 13, y: 12 },
    /** Passage en qualité réduite si la moyenne glissante passe sous ce FPS */
    lowFps: 60,
    /** Pas de dimming de nuit en réalité mixte (on garde la pièce lisible) */
    nightDim: 0.35,
  },

  /** Tutoriel et aides */
  help: {
    /** Étapes du tutoriel (identifiants) dans l'ordre */
    steps: ['grab', 'drop', 'tap', 'zoom'] as const,
    /** Fantôme de main : cycle d'animation (s) */
    ghostCycle: 2.6,
    /** Aide du poignet : angle (degrés) entre la paume et le regard pour l'afficher */
    wristAngle: 40,
  },

  /** Retours (sons et vibrations) */
  feedback: {
    haptics: { hover: [0.12, 25], click: [0.35, 45], grab: [0.5, 60], drop: [0.7, 70], error: [0.9, 120], event: [0.45, 180], thud: [0.85, 90] } as Record<string, [number, number]>,
    volume: 0.12,
  },
} as const;

export type HelpStep = (typeof VR_CONFIG.help.steps)[number];
