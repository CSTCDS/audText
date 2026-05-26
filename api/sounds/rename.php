<?php
// api/sounds/rename.php
// Expects JSON { old: "oldname.ext", new: "newname.ext" }
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
// Ensure PHP does not output warnings/notices that would break JSON
@ini_set('display_errors', '0');
@error_reporting(0);
// Buffer output so we can return clean JSON even if PHP emitted something
if (!ob_get_level()) ob_start();

$input = json_decode(file_get_contents('php://input'), true);
if (!$input || !isset($input['old']) || !isset($input['new'])){
    http_response_code(400);
    if (ob_get_length()) ob_clean();
    echo json_encode(['success'=>false,'message'=>'invalid payload']);
    exit;
}

$dir = realpath(__DIR__ . '/../../assets/sound');
if ($dir === false || !is_dir($dir)){
    http_response_code(500);
    if (ob_get_length()) ob_clean();
    echo json_encode(['success'=>false,'message'=>'sound directory not found']);
    exit;
}

// Accept relative paths but sanitize them
$oldRel = str_replace('\\','/',$input['old']);
$newRel = str_replace('\\','/',$input['new']);
$oldRel = ltrim($oldRel, '/');
$newRel = ltrim($newRel, '/');
if (strpos($oldRel, '..') !== false || strpos($newRel, '..') !== false){
    http_response_code(400);
    if (ob_get_length()) ob_clean();
    echo json_encode(['success'=>false,'message'=>'invalid path']);
    exit;
}

$oldDir = dirname($oldRel);
if ($oldDir === '.') $oldDir = '';
$newDir = dirname($newRel);
if ($newDir === '.') $newDir = '';
// don't allow moving files across directories via this endpoint
if ($oldDir !== $newDir){
    http_response_code(400);
    if (ob_get_length()) ob_clean();
    echo json_encode(['success'=>false,'message'=>'renaming across directories not allowed']);
    exit;
}

$oldBase = basename($oldRel);
$newBase = basename($newRel);
// validate extension on new name
if (!preg_match('/\.(mp3|wav)$/i', $newBase)){
    http_response_code(400);
    if (ob_get_length()) ob_clean();
    echo json_encode(['success'=>false,'message'=>'invalid extension']);
    exit;
}

$oldPath = $dir . DIRECTORY_SEPARATOR . ($oldDir ? str_replace('/','\\', $oldDir) . DIRECTORY_SEPARATOR : '') . $oldBase;
$newPath = $dir . DIRECTORY_SEPARATOR . ($newDir ? str_replace('/','\\', $newDir) . DIRECTORY_SEPARATOR : '') . $newBase;

if (!file_exists($oldPath)){
    http_response_code(404);
    if (ob_get_length()) ob_clean();
    echo json_encode(['success'=>false,'message'=>'old file not found','path'=>$oldPath]);
    exit;
}
if (file_exists($newPath)){
    http_response_code(409);
    if (ob_get_length()) ob_clean();
    echo json_encode(['success'=>false,'message'=>'target already exists']);
    exit;
}

$ok = @rename($oldPath, $newPath);
if (!$ok){
    $err = error_get_last();
    $msg = $err && isset($err['message']) ? $err['message'] : 'rename failed';
    http_response_code(500);
    if (ob_get_length()) ob_clean();
    echo json_encode(['success'=>false,'message'=>$msg]);
    exit;
}

// Optionally update list.json
try{
    $files = array_values(array_filter(scandir($dir), function($f){
        return preg_match('/\.(mp3|wav)$/i', $f);
    }));
    natcasesort($files);
    file_put_contents($dir . DIRECTORY_SEPARATOR . 'list.json', json_encode(array_values($files), JSON_PRETTY_PRINT|JSON_UNESCAPED_UNICODE));
}catch(Throwable $e){ }

// Flush any buffered output and return clean JSON
if (ob_get_length()) ob_clean();
echo json_encode(['success'=>true,'new'=>$new]);
if (ob_get_level()) ob_end_flush();
