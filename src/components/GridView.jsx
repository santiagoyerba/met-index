import { objMatchesActiveTags, getMatchingColors } from '../utils/met';

export default function GridView({ objects, activeTags, tagColors }) {
  const anyActive = activeTags.size > 0;

  return (
    <div id="view-grid">
      <div id="grid-body">
        {objects.map(obj => {
          const hit = objMatchesActiveTags(obj, activeTags);
          let borderStyle;
          if (anyActive && hit) {
            const colors = getMatchingColors(obj, activeTags, tagColors);
            if (colors.length >= 2) {
              borderStyle = { borderImage: `linear-gradient(to right, ${colors[0]}, ${colors[1]}) 1` };
            } else if (colors.length === 1) {
              borderStyle = { borderBottomColor: colors[0] };
            }
          }
          return (
            <div
              key={obj.objectID}
              className={`grid-card${anyActive && !hit ? ' dimmed' : ''}`}
              style={borderStyle}
            >
              <img src={obj.primaryImageSmall} alt={obj.title} loading="lazy" />
            </div>
          );
        })}
      </div>
    </div>
  );
}
