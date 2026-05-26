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

// Recursively collect .mp3 and .wav files
$files = [];
$it = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($dir, RecursiveDirectoryIterator::SKIP_DOTS));
foreach ($it as $fileinfo) {
    if ($fileinfo->isFile()) {
        $name = $fileinfo->getFilename();
        if (preg_match('/\.(mp3|wav)$/i', $name)) {
            // store relative path from assets/sound
            $rel = str_replace($dir . DIRECTORY_SEPARATOR, '', $fileinfo->getPathname());
            $rel = str_replace('\\', '/', $rel);
            $files[] = $rel;
        }
    }
}

// Natural sort
natcasesort($files);
$files = array_values($files);

echo json_encode($files);
