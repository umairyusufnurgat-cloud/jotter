/* ============================================================
   Jotter — tiny markdown renderer (GFM-flavoured subset)
   Zero dependencies. Supports:
   headings, bold, italic, strike, inline code, fenced code,
   blockquotes, nested ordered/unordered lists, task lists
   (interactive via data-task line numbers), tables, links,
   images, autolinks, horizontal rules, backslash escapes.
   All content is HTML-escaped; URLs are scheme-sanitised.
   ============================================================ */
(function (global) {
  'use strict';

  var ESC_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ESC_MAP[c]; });
  }

  function safeUrl(url, isImage) {
    var u = String(url == null ? '' : url).trim();
    if (isImage && /^data:image\//i.test(u)) return u; // embedded images (safe in <img>)
    if (/^(https?:|mailto:|tel:)/i.test(u)) return u;
    if (/^(\.\.?=?)?[\/#.]/.test(u)) return u; // relative paths, anchors
    return '#';
  }

  /* ---------------- inline parsing ---------------- */
  function renderInline(src) {
    var stash = [];

    function keep(html) {
      stash.push(html);
      return '\u0001' + (stash.length - 1) + '\u0001';
    }

    var text = String(src == null ? '' : src);

    // 1. backslash escapes  \* \` \_ …
    text = text.replace(/\\([\\`*_~[\]()#>!|-])/g, function (m, ch) {
      return keep(escapeHtml(ch));
    });

    // 2. code spans  `code`  (double backticks allowed)
    text = text.replace(/(`+)([\s\S]*?)\1/g, function (m, ticks, code) {
      var c = code.replace(/^ ([\s\S]*) $/, '$1'); // strip one surrounding space
      return keep('<code>' + escapeHtml(c) + '</code>');
    });

    // 2b. wiki links  [[Note Title]]  (resolved by the app)
    text = text.replace(/\[\[([^\][\n]+?)\s*\]\]/g, function (m, title) {
      var t = title.trim();
      return keep('<a href="#" class="wiki-link" data-wiki="' + escapeHtml(t) + '">' + escapeHtml(t) + '</a>');
    });

    // 3. images  ![alt](url)
    text = text.replace(/!\[([^\]]*)\]\(\s*(\S+)(?:\s+["'](.*?)["'])?\s*\)/g, function (m, alt, url, title) {
      var t = title ? ' title="' + escapeHtml(title) + '"' : '';
      return keep('<img src="' + escapeHtml(safeUrl(url, true)) + '" alt="' + escapeHtml(alt) + '"' + t + ' loading="lazy">');
    });

    // 4. links  [text](url)
    text = text.replace(/\[([^\]]*)\]\(\s*(\S+)(?:\s+["'](.*?)["'])?\s*\)/g, function (m, label, url, title) {
      var t = title ? ' title="' + escapeHtml(title) + '"' : '';
      return keep('<a href="' + escapeHtml(safeUrl(url)) + '"' + t + ' target="_blank" rel="noopener noreferrer">' + escapeHtml(label) + '</a>');
    });

    // 5. escape everything that is left
    text = escapeHtml(text);

    // 6. emphasis (operates on escaped text)
    text = text.replace(/\*\*([\s\S]+?)\*\*/g, '<strong>$1</strong>');
    text = text.replace(/(^|[^\w])__([\s\S]+?)__(?!\w)/g, '$1<strong>$2</strong>');
    text = text.replace(/(^|[\s(>])\*([^*\n]+?)\*(?=$|[\s).,!?:;<])/g, '$1<em>$2</em>');
    text = text.replace(/(^|[^\w])_([^_\n]+?)_(?!\w)/g, '$1<em>$2</em>');
    text = text.replace(/~~([^~\n]+)~~/g, '<del>$1</del>');

    // 7. bare URLs
    text = text.replace(/(^|[\s(])(https?:\/\/[^\s\u0001<>"']+)/g, function (m, pre, url) {
      return pre + '<a href="' + url + '" target="_blank" rel="noopener noreferrer">' + url + '</a>';
    });

    // 8. restore stashed html
    text = text.replace(/\u0001(\d+)\u0001/g, function (m, i) {
      return stash[+i];
    });

    return text;
  }

  /* ---------------- block parsing ---------------- */
  function isBlockStart(line) {
    var t = line.trim();
    if (!t) return true;
    if (/^```/.test(t)) return true;
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(t)) return true;
    if (/^#{1,6}\s/.test(t)) return true;
    if (/^>/.test(t)) return true;
    if (/^(\s*)([-*+]|\d{1,9}[.)])\s+/.test(line)) return true;
    return false;
  }

  function splitTableRow(row) {
    var r = row.trim();
    if (r.charAt(0) === '|') r = r.slice(1);
    if (r.charAt(r.length - 1) === '|' && !/\\\|$/.test(r)) r = r.slice(0, -1);
    var cells = [], cur = '';
    for (var k = 0; k < r.length; k++) {
      if (r.charAt(k) === '\\' && r.charAt(k + 1) === '|') { cur += '|'; k++; }
      else if (r.charAt(k) === '|') { cells.push(cur); cur = ''; }
      else cur += r.charAt(k);
    }
    cells.push(cur);
    return cells;
  }

  function render(src) {
    var lines = String(src == null ? '' : src).replace(/\r\n?/g, '\n').split('\n');
    var out = [];
    var i = 0;

    function inline(s) { return renderInline(s); }

    while (i < lines.length) {
      var line = lines[i];
      var t = line.trim();

      /* blank */
      if (!t) { i++; continue; }

      /* fenced code block */
      if (/^```/.test(t)) {
        var lang = t.replace(/^```/, '').trim();
        var buf = [];
        i++;
        while (i < lines.length && lines[i].trim() !== '```') { buf.push(lines[i]); i++; }
        if (i < lines.length) i++; // skip closing fence
        out.push('<pre class="code-block"' + (lang ? ' data-lang="' + escapeHtml(lang) + '"' : '') +
          '><code>' + escapeHtml(buf.join('\n')) + '</code></pre>');
        continue;
      }

      /* horizontal rule */
      if (/^(-{3,}|\*{3,}|_{3,})$/.test(t)) { out.push('<hr>'); i++; continue; }

      /* heading */
      var h = t.match(/^(#{1,6})\s+(.*)$/);
      if (h) {
        var lvl = h[1].length;
        var content = h[2].replace(/\s+#+\s*$/, '');
        out.push('<h' + lvl + '>' + inline(content) + '</h' + lvl + '>');
        i++;
        continue;
      }

      /* blockquote */
      if (/^>/.test(t)) {
        var q = [];
        while (i < lines.length && /^\s*>/.test(lines[i])) {
          q.push(lines[i].replace(/^\s*>\s?/, ''));
          i++;
        }
        out.push('<blockquote>' + q.map(inline).join('<br>') + '</blockquote>');
        continue;
      }

      /* table */
      if (t.indexOf('|') !== -1 && i + 1 < lines.length &&
          /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(lines[i + 1])) {
        var headCells = splitTableRow(lines[i]).map(function (c) { return inline(c.trim()); });
        var aligns = splitTableRow(lines[i + 1]).map(function (c) {
          var a = c.trim();
          var l = a.charAt(0) === ':', r = a.charAt(a.length - 1) === ':';
          return (l && r) ? 'center' : (r ? 'right' : (l ? 'left' : ''));
        });
        i += 2;
        var rows = [];
        while (i < lines.length && lines[i].trim() && lines[i].indexOf('|') !== -1 && !isBlockStart(lines[i])) {
          rows.push(splitTableRow(lines[i]).map(function (c) { return inline(c.trim()); }));
          i++;
        }
        var thead = '<tr>' + headCells.map(function (c, ci) {
          var a = aligns[ci] ? ' style="text-align:' + aligns[ci] + '"' : '';
          return '<th' + a + '>' + c + '</th>';
        }).join('') + '</tr>';
        var tbody = rows.map(function (row) {
          return '<tr>' + row.map(function (c, ci) {
            var a = aligns[ci] ? ' style="text-align:' + aligns[ci] + '"' : '';
            return '<td' + a + '>' + c + '</td>';
          }).join('') + '</tr>';
        }).join('');
        out.push('<div class="table-wrap"><table><thead>' + thead + '</thead><tbody>' + tbody + '</tbody></table></div>');
        continue;
      }

      /* lists (nested, tasks) */
      var li = line.match(/^(\s*)([-*+]|\d{1,9}[.)])\s+(.*)$/);
      if (li) {
        var items = [];
        while (i < lines.length) {
          var m = lines[i].match(/^(\s*)([-*+]|\d{1,9}[.)])\s+(.*)$/);
          if (m) {
            items.push({
              indent: m[1].replace(/\t/g, '  ').length,
              ordered: /\d/.test(m[2].charAt(0)),
              text: m[3],
              line: i
            });
            i++;
          } else if (items.length && lines[i].trim() && /^\s{2,}\S/.test(lines[i]) && !isBlockStart(lines[i])) {
            items[items.length - 1].text += '<br>' + lines[i].trim(); // lazy continuation
            i++;
          } else break;
        }

        var html = '';
        var stack = [];
        for (var it = 0; it < items.length; it++) {
          var item = items[it];
          var lvl = Math.floor(item.indent / 2);
          if (!stack.length) lvl = 0;
          else if (lvl > stack[stack.length - 1].lvl + 1) lvl = stack[stack.length - 1].lvl + 1;

          if (!stack.length) {
            stack.push({ lvl: lvl, ordered: item.ordered });
            html += item.ordered ? '<ol>' : '<ul>';
          } else if (lvl > stack[stack.length - 1].lvl) {
            stack.push({ lvl: lvl, ordered: item.ordered });
            html += item.ordered ? '<ol>' : '<ul>';
          } else {
            while (stack.length > 1 && stack[stack.length - 1].lvl > lvl) {
              html += '</li>'; // close the item at the level being popped
              html += stack.pop().ordered ? '</ol>' : '</ul>';
            }
            var top = stack[stack.length - 1];
            if (top.lvl === lvl && top.ordered !== item.ordered) {
              // ordered/unordered switch at the same level → start a new list
              html += '</li>' + (stack.pop().ordered ? '</ol>' : '</ul>');
              stack.push({ lvl: lvl, ordered: item.ordered });
              html += item.ordered ? '<ol>' : '<ul>';
            } else {
              html += '</li>'; // close previous sibling
            }
          }

          var tm = item.text.match(/^\[([ xX])\]\s*(.*)$/);
          if (tm) {
            var done = tm[1] !== ' ';
            html += '<li class="task' + (done ? ' done' : '') + '">' +
              '<input type="checkbox" tabindex="-1" title="Click to toggle"' +
              (done ? ' checked' : '') + ' data-task="' + item.line + '">' +
              '<span class="task-label">' + inline(tm[2]) + '</span>';
          } else {
            html += '<li>' + inline(item.text);
          }
        }
        while (stack.length) {
          html += '</li>' + (stack.pop().ordered ? '</ol>' : '</ul>');
        }
        out.push(html);
        continue;
      }

      /* paragraph */
      var para = [t];
      i++;
      while (i < lines.length && !isBlockStart(lines[i])) {
        para.push(lines[i].trim());
        i++;
      }
      out.push('<p>' + para.map(inline).join('<br>') + '</p>');
    }

    return out.join('\n');
  }

  global.JotterMD = { render: render, renderInline: renderInline };

  if (typeof module !== 'undefined' && module.exports) module.exports = { render: render, renderInline: renderInline };
})(typeof window !== 'undefined' ? window : globalThis);
