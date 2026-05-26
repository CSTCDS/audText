<?php
// api/sounds/rename.php
// Expects JSON { old: "oldname.ext", new: "newname.ext" }
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

$input = json_decode(file_get_contents('php://input'), true);
if (!$input || !isset($input['old']) || !isset($input['new'])){
    http_response_code(400);
    echo json_encode(['success'=>false,'message'=>'invalid payload']);
    exit;
}

$dir = realpath(__DIR__ . '/../../assets/sound');
if ($dir === false || !is_dir($dir)){
    http_response_code(500);
    echo json_encode(['success'=>false,'message'=>'sound directory not found']);
    exit;
}

$old = basename($input['old']);
$new = basename($input['new']);
// validate extension
if (!preg_match('/\.(mp3|wav)$/i', $new)){
    http_response_code(400);
    echo json_encode(['success'=>false,'message'=>'invalid extension']);
    exit;
}

$oldPath = $dir . DIRECTORY_SEPARATOR . $old;
$newPath = $dir . DIRECTORY_SEPARATOR . $new;

if (!file_exists($oldPath)){
    http_response_code(404);
    echo json_encode(['success'=>false,'message'=>'old file not found']);
    exit;
}
if (file_exists($newPath)){
    http_response_code(409);
    echo json_encode(['success'=>false,'message'=>'target already exists']);
    exit;
}

$ok = rename($oldPath, $newPath);
if (!$ok){
    http_response_code(500);
    echo json_encode(['success'=>false,'message'=>'rename failed']);
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

echo json_encode(['success'=>true,'new'=>$new]);
