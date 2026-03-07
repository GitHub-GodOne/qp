use axum::{
    body::Body,
    http::{header, StatusCode, Uri},
    response::{IntoResponse, Response},
};
use include_dir::{include_dir, Dir};

// 将前端构建产物嵌入到二进制文件中
static STATIC_DIR: Dir<'_> = include_dir!("$CARGO_MANIFEST_DIR/frontend/dist");

/// 处理静态文件请求
pub async fn serve_static(uri: Uri) -> Response {
    let path = uri.path().trim_start_matches('/');

    // 如果路径为空，返回 index.html
    let path = if path.is_empty() { "index.html" } else { path };

    // 尝试获取文件
    if let Some(file) = STATIC_DIR.get_file(path) {
        let mime_type = mime_guess::from_path(path).first_or_octet_stream();

        Response::builder()
            .status(StatusCode::OK)
            .header(header::CONTENT_TYPE, mime_type.as_ref())
            .body(Body::from(file.contents()))
            .unwrap()
    } else {
        // 对于 SPA，所有未找到的路由都返回 index.html
        if let Some(index) = STATIC_DIR.get_file("index.html") {
            Response::builder()
                .status(StatusCode::OK)
                .header(header::CONTENT_TYPE, "text/html")
                .body(Body::from(index.contents()))
                .unwrap()
        } else {
            (StatusCode::NOT_FOUND, "404 Not Found").into_response()
        }
    }
}
