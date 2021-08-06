export const request = ({
	url,
	method = 'post',
	data,
	headers = {},
	onProgress,
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
			resolve({
				data: e.target.response,
			});
		};
	});
};
