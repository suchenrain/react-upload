export const request = ({
	url,
	method = 'post',
	data,
	headers = {},
	onProgress,
	requestList,
}) => {
	return new Promise((resolve, reject) => {
		const xhr = new XMLHttpRequest();
		xhr.open(method, url);
		//set headers
		Object.keys(headers).forEach((key) =>
			xhr.setRequestHeader(key, headers[key])
		);
		xhr.upload.onprogress = onProgress;
		xhr.send(data);
		xhr.onload = (e) => {
			if (e.currentTarget.status === 200) {
				if (requestList && requestList.length > 0) {
					let itemIndex = requestList.findIndex(
						(item) => item === xhr
					);
					requestList.splice(itemIndex, 1);
				}
				resolve({
					data: e.target.response,
				});
			} else {
				reject(new Error('上传失败'));
			}
		};
		xhr.onerror = () => {
			reject(new Error('网络好像出问题啦~'));
		};

		requestList?.push(xhr);
	});
};
