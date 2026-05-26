<?php
// api/sounds/index.php
// Returns JSON array of .mp3 and .wav filenames from ../../assets/sound
header('Content-Type: application/json; charset=utf-8');
// If needed, enable CORS for cross-origin requests (remove or restrict in production)
header('Access-Control-Allow-Origin: *');

$dir = realpath(__DIR__ . '/../../assets/sound');
if ($dir === false || !is_dir($dir)) {
    http_response_code(404);
    echo json_encode([]);
    exit;
}

$all = scandir($dir);
$files = array_values(array_filter($all, function($f) use ($dir) {
    if ($f === '.' || $f === '..') return false;
    $full = $dir . DIRECTORY_SEPARATOR . $f;
    if (!is_file($full)) return false;
    return preg_match('/\.(mp3|wav)$/i', $f);
}));

// Natural sort
natcasesort($files);
$files = array_values($files);

echo json_encode($files);
