import { Crepe, CrepeFeature } from '@milkdown/crepe'
import { useEffect, useRef } from 'react'

// Structure styles only — colors/fonts come from the --crepe-* mapping in
// styles.css, so the editor follows the panel theme (ADR: release-log).
import '@milkdown/crepe/theme/common/style.css'

/**
 * WYSIWYG markdown editor (Milkdown Crepe). Word pastes arrive as clipboard
 * HTML and are parsed by ProseMirror; markdown source pastes are detected and
 * parsed by the bundled clipboard plugin. Remount (via React `key`) to switch
 * documents — Crepe has no setMarkdown.
 */
export function NotesEditor({
  defaultValue,
  placeholder,
  onChange,
}: {
  defaultValue: string
  placeholder: string
  onChange: (markdown: string) => void
}) {
  const rootRef = useRef<HTMLDivElement>(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const crepe = new Crepe({
      root,
      defaultValue,
      features: {
        [CrepeFeature.Latex]: false,
        [CrepeFeature.ImageBlock]: false,
      },
      featureConfigs: {
        [CrepeFeature.Placeholder]: { text: placeholder, mode: 'block' },
      },
    })
    crepe.on((listener) => {
      listener.markdownUpdated((_ctx, markdown) => onChangeRef.current(markdown))
    })
    // Serialize create → destroy: destroying before creation finishes races
    // the listener's debounced serializer (milkdown#2356).
    const created = crepe.create()
    return () => {
      void created.then(() => crepe.destroy()).catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- remount via key, not props
  }, [])

  return <div ref={rootRef} />
}
