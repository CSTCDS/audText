<?php
// API endpoint to list server-side sound files for the app.
// Returns JSON: { dir: "/full/path/to/assets/sound", files: ["a.mp3","b.mp3"] }

header('Content-Type: application/json');

$soundDir = realpath(__DIR__ . '/../../assets/sound');
$files = [];
if ($soundDir && is_dir($soundDir)){
  $items = scandir($soundDir);
  foreach($items as $it){
    if ($it === '.' || $it === '..') continue;
    $full = $soundDir . DIRECTORY_SEPARATOR . $it;
    if (is_file($full) && strtolower(pathinfo($it, PATHINFO_EXTENSION)) === 'mp3'){
      $files[] = $it;
    }
  }
  sort($files);
}

echo json_encode(['dir' => $soundDir ?: '', 'files' => $files], JSON_UNESCAPED_SLASHES|JSON_UNESCAPED_UNICODE);
