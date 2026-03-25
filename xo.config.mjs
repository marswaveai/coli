const xoConfig = [
	{
		prettier: true,
		rules: {
			'@typescript-eslint/only-throw-error': 'off',
			'sort-imports': [
				'error',
				{
					ignoreCase: false,
					ignoreDeclarationSort: true,
					ignoreMemberSort: false,
					memberSyntaxSortOrder: ['none', 'all', 'multiple', 'single'],
					allowSeparatedGroups: false,
				},
			],
			'import-x/no-named-as-default': 'off',
			'import-x/extensions': 'off',
			'import-x/order': [
				'error',
				{
					groups: ['builtin', 'external', 'parent', 'sibling', 'index'],
					alphabetize: {
						order: 'asc',
						caseInsensitive: true,
					},
					warnOnUnassignedImports: true,
					'newlines-between': 'never',
				},
			],
		},
	},
];

export default xoConfig;
