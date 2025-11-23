jest.mock('electron', () => {
	return {
		app: {
			getPath: jest.fn().mockReturnValue('/tmp/test-user-data'),
		},
	};
});
