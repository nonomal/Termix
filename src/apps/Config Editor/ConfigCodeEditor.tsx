import React, { useState, useEffect } from "react";
import CodeMirror from "@uiw/react-codemirror";
import type { LanguageName } from '@uiw/codemirror-extensions-langs';
import { loadLanguage } from '@uiw/codemirror-extensions-langs';
import { hyperLink } from '@uiw/codemirror-extensions-hyper-link';
import { EditorView } from '@codemirror/view';
import { createTheme } from '@uiw/codemirror-themes';
import { tags as t } from '@lezer/highlight';

interface ConfigCodeEditorProps {
    content: string;
    fileName: string;
    onContentChange: (value: string) => void;
}

export function ConfigCodeEditor({content, fileName, onContentChange,}: ConfigCodeEditorProps) {
    const langName = getLanguageName(fileName);
    const langExt = langName ? loadLanguage(langName) : null;
    const extensions = [hyperLink];
    if (langExt) extensions.unshift(langExt);

    // Custom theme based on built-in 'dark', with overrides for background, gutter, and font size
    const customDarkTheme = [
        createTheme({
            theme: 'dark',
            settings: {
                background: '#09090b',
                gutterBackground: '#18181b',
                gutterForeground: 'oklch(0.985 0 0)',
                foreground: '#e0e0e0',
                caret: '#ffcc00',
                selection: '#22223b99',
                selectionMatch: '#22223b66',
                lineHighlight: '#18181b',
                gutterBorder: '1px solid #22223b',
            },
            styles: [
                { tag: t.keyword, color: '#ff5370' }, // red
                { tag: t.string, color: '#c3e88d' }, // green
                { tag: t.number, color: '#82aaff' }, // blue
                { tag: t.comment, color: '#5c6370' }, // gray
                { tag: t.variableName, color: '#f78c6c' }, // orange
                { tag: t.function(t.variableName), color: '#82aaff' }, // blue
                { tag: t.typeName, color: '#ffcb6b' }, // yellow
                { tag: t.className, color: '#ffcb6b' }, // yellow
                { tag: t.definition(t.typeName), color: '#ffcb6b' }, // yellow
                { tag: t.operator, color: '#89ddff' }, // cyan
                { tag: t.bool, color: '#f78c6c' }, // orange
                { tag: t.null, color: '#f78c6c' }, // orange
                { tag: t.tagName, color: '#ff5370' }, // red
                { tag: t.attributeName, color: '#c792ea' }, // purple
                { tag: t.angleBracket, color: '#89ddff' }, // cyan
            ],
        }),
        EditorView.theme({
            '&': {
                fontSize: '13px',
            },
        }),
    ];

    function getLanguageName(filename: string): LanguageName | undefined {
        const ext = filename.slice(filename.lastIndexOf('.') + 1).toLowerCase();
        switch (ext) {
            case 'js':
            case 'mjs':
            case 'cjs': return 'javascript';
            case 'ts': return 'typescript';
            case 'tsx': return 'tsx';
            case 'json': return 'json';
            case 'css': return 'css';
            case 'html':
            case 'htm': return 'html';
            case 'md': return 'markdown';
            case 'py': return 'python';
            case 'sh': return 'shell';
            case 'yaml':
            case 'yml': return 'yaml';
            case 'go': return 'go';
            case 'java': return 'java';
            case 'c': return 'c';
            case 'cpp':
            case 'cc':
            case 'cxx': return 'cpp';
            case 'rs': return 'rust';
            case 'php': return 'php';
            case 'rb': return 'ruby';
            case 'swift': return 'swift';
            case 'lua': return 'lua';
            case 'xml': return 'xml';
            case 'sql': return 'sql';
            default: return undefined;
        }
    }

    useEffect(() => {
        document.body.style.overflowX = 'hidden';
        return () => {
            document.body.style.overflowX = '';
        };
    }, []);

    return (
        <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div
                style={{
                    width: '100%',
                    height: '100%',
                    overflow: 'auto',
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                }}
                className="config-codemirror-scroll-wrapper"
            >
                <CodeMirror
                    value={content}
                    extensions={extensions.concat(customDarkTheme)}
                    onChange={(value: any) => onContentChange(value)}
                    theme={customDarkTheme}
                    height="100%"
                    basicSetup={{ lineNumbers: true }}
                    style={{ minHeight: '100%', minWidth: '100%', flex: 1 }}
                />
            </div>
        </div>
    );
}