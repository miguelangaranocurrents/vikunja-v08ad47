import {Extension, getTextSerializersFromSchema} from '@tiptap/core'
import {Plugin, PluginKey} from '@tiptap/pm/state'
import type {Fragment, Node as ProseMirrorNode} from '@tiptap/pm/model'

type Serializers = ReturnType<typeof getTextSerializersFromSchema>

function serializeFragment(
	fragment: Fragment,
	separator: string,
	serializers: Serializers,
	marker?: (index: number, child: ProseMirrorNode) => string,
): string {
	const parts: string[] = []
	fragment.forEach((child, _offset, index) => {
		parts.push((marker ? marker(index, child) : '') + serializeNode(child, serializers))
	})
	return parts.join(separator)
}

function indentContinuation(text: string, indent: string): string {
	return text.split('\n').map((line, i) => i === 0 || line === '' ? line : indent + line).join('\n')
}

function serializeNode(node: ProseMirrorNode, serializers: Serializers): string {
	if (node.isText) {
		return node.text ?? ''
	}

	const custom = serializers[node.type.name]
	if (custom) {
		return custom({node, pos: 0, parent: node, index: 0, range: {from: 0, to: node.nodeSize}})
	}

	if (node.isLeaf) {
		return node.type.name === 'hardBreak' ? '\n' : ''
	}

	switch (node.type.name) {
		case 'bulletList':
			return serializeFragment(node.content, '\n', serializers, () => '- ')
		case 'orderedList': {
			const start = (node.attrs.start as number | undefined) ?? 1
			return serializeFragment(node.content, '\n', serializers, index => `${start + index}. `)
		}
		case 'taskList':
			return serializeFragment(node.content, '\n', serializers, (_index, child) => child.attrs.checked ? '- [x] ' : '- [ ] ')
		case 'listItem':
		case 'taskItem':
			return indentContinuation(serializeFragment(node.content, '\n', serializers), '  ')
		default:
			return serializeFragment(node.content, node.isTextblock ? '' : '\n\n', serializers)
	}
}

/**
 * Plain-text clipboard flavour that keeps list markers, which the default
 * serializer drops.
 */
export const ClipboardListMarkers = Extension.create({
	name: 'clipboardListMarkers',
	priority: 1000,

	addProseMirrorPlugins() {
		const serializers = getTextSerializersFromSchema(this.editor.schema)
		return [
			new Plugin({
				key: new PluginKey('clipboardListMarkers'),
				props: {
					clipboardTextSerializer: slice => serializeFragment(slice.content, '\n\n', serializers),
				},
			}),
		]
	},
})
