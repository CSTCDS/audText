<?php
function list_files($dir, $ext){
  $files = [];
  if (!is_dir($dir)) return $files;
  $items = scandir($dir);
  foreach($items as $it){
    if ($it === '.' || $it === '..') continue;
    if (is_file($dir.DIRECTORY_SEPARATOR.$it) && strtolower(pathinfo($it, PATHINFO_EXTENSION)) === ltrim($ext, '.')){
      $files[] = $it;
    }
  }
  sort($files);
  return $files;
}

$soundDir = __DIR__ . '/assets/sound';
$textDir = __DIR__ . '/assets/txt';
$sounds = list_files($soundDir, '.mp3');
$texts = list_files($textDir, '.html');
?>
<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>audioTexte - PWA</title>
  <link rel="manifest" href="manifest.json">
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <main>
    <header>
      <h1>audioTexte</h1>
    </header>

    <section id="top">
      <div id="text-area" class="text-area">Chargement du texte...</div>
    </section>

    <section id="buttons-area">
      <div class="buttons-grid" id="buttons-grid"></div>
    </section>
  </main>

  <script>
    // Inject lists from server-side filesystem
    window.SOUND_LIST = <?php echo json_encode($sounds, JSON_UNESCAPED_SLASHES|JSON_UNESCAPED_UNICODE); ?>;
    window.TEXT_LIST = <?php echo json_encode($texts, JSON_UNESCAPED_SLASHES|JSON_UNESCAPED_UNICODE); ?>;
  </script>
  <script src="app.js"></script>
  <script>
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('service-worker.js').catch(e => console.log('SW registration failed', e));
    }
  </script>
</body>
</html>
