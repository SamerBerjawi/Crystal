/**
 * Untitled UI Icons Catalog & Search Index
 * 1,100+ Free SVG Icons from @untitledui/icons (https://www.untitledui.com/free-icons)
 */

export interface UntitledUiIconItem {
  name: string;
  label: string;
  category: string;
  baseFamily: string;
  isFirstVariant: boolean;
  variantCount: number;
  familyVariants: string[];
  tags: string[];
}

export const UNTITLED_UI_CATEGORIES = [
  'View all',
  'Finance & eCommerce',
  'Charts',
  'Users',
  'Security',
  'Communication',
  'Media & devices',
  'Layout',
  'Files',
  'Editor',
  'Time',
  'Maps & travel',
  'Education',
  'Weather',
  'Alerts & feedback',
  'Arrows',
  'Development',
  'Shapes',
  'Images',
  'General',
] as const;

export type UntitledUiCategory = (typeof UNTITLED_UI_CATEGORIES)[number];

export const UNTITLED_UI_ICONS: UntitledUiIconItem[] = [
  {
    "name": "Activity",
    "label": "Activity",
    "category": "Charts",
    "baseFamily": "Activity",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "Activity"
    ],
    "tags": [
      "activity",
      "health",
      "heartbeat",
      "gym",
      "fitness",
      "pulse",
      "vital",
      "sports",
      "workout"
    ]
  },
  {
    "name": "ActivityHeart",
    "label": "Activity Heart",
    "category": "Charts",
    "baseFamily": "ActivityHeart",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "ActivityHeart"
    ],
    "tags": [
      "activity",
      "heart",
      "cardio",
      "health",
      "fitness",
      "wellness",
      "cardiology",
      "activityheart",
      "activity heart"
    ]
  },
  {
    "name": "Airplay",
    "label": "Airplay",
    "category": "Media & devices",
    "baseFamily": "Airplay",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "Airplay"
    ],
    "tags": [
      "airplay"
    ]
  },
  {
    "name": "Airpods",
    "label": "Airpods",
    "category": "Media & devices",
    "baseFamily": "Airpods",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "Airpods"
    ],
    "tags": [
      "airpods"
    ]
  },
  {
    "name": "AlarmClock",
    "label": "Alarm Clock",
    "category": "Time",
    "baseFamily": "AlarmClock",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "AlarmClock"
    ],
    "tags": [
      "alarm",
      "clock",
      "alarmclock",
      "alarm clock"
    ]
  },
  {
    "name": "AlarmClockCheck",
    "label": "Alarm Clock Check",
    "category": "Time",
    "baseFamily": "AlarmClockCheck",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "AlarmClockCheck"
    ],
    "tags": [
      "alarm",
      "clock",
      "check",
      "alarmclockcheck",
      "alarm clock check"
    ]
  },
  {
    "name": "AlarmClockMinus",
    "label": "Alarm Clock Minus",
    "category": "Time",
    "baseFamily": "AlarmClockMinus",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "AlarmClockMinus"
    ],
    "tags": [
      "alarm",
      "clock",
      "minus",
      "alarmclockminus",
      "alarm clock minus"
    ]
  },
  {
    "name": "AlarmClockOff",
    "label": "Alarm Clock Off",
    "category": "Time",
    "baseFamily": "AlarmClockOff",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "AlarmClockOff"
    ],
    "tags": [
      "alarm",
      "clock",
      "off",
      "alarmclockoff",
      "alarm clock off"
    ]
  },
  {
    "name": "AlarmClockPlus",
    "label": "Alarm Clock Plus",
    "category": "Time",
    "baseFamily": "AlarmClockPlus",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "AlarmClockPlus"
    ],
    "tags": [
      "alarm",
      "clock",
      "plus",
      "alarmclockplus",
      "alarm clock plus"
    ]
  },
  {
    "name": "AlertCircle",
    "label": "Alert Circle",
    "category": "Alerts & feedback",
    "baseFamily": "AlertCircle",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "AlertCircle"
    ],
    "tags": [
      "alert",
      "circle",
      "alertcircle",
      "alert circle"
    ]
  },
  {
    "name": "AlertHexagon",
    "label": "Alert Hexagon",
    "category": "Alerts & feedback",
    "baseFamily": "AlertHexagon",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "AlertHexagon"
    ],
    "tags": [
      "alert",
      "hexagon",
      "alerthexagon",
      "alert hexagon"
    ]
  },
  {
    "name": "AlertOctagon",
    "label": "Alert Octagon",
    "category": "Alerts & feedback",
    "baseFamily": "AlertOctagon",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "AlertOctagon"
    ],
    "tags": [
      "alert",
      "octagon",
      "alertoctagon",
      "alert octagon"
    ]
  },
  {
    "name": "AlertSquare",
    "label": "Alert Square",
    "category": "Alerts & feedback",
    "baseFamily": "AlertSquare",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "AlertSquare"
    ],
    "tags": [
      "alert",
      "square",
      "alertsquare",
      "alert square"
    ]
  },
  {
    "name": "AlertTriangle",
    "label": "Alert Triangle",
    "category": "Alerts & feedback",
    "baseFamily": "AlertTriangle",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "AlertTriangle"
    ],
    "tags": [
      "alert",
      "triangle",
      "alerttriangle",
      "alert triangle"
    ]
  },
  {
    "name": "AlignBottom01",
    "label": "Align Bottom 01",
    "category": "Layout",
    "baseFamily": "AlignBottom",
    "isFirstVariant": true,
    "variantCount": 2,
    "familyVariants": [
      "AlignBottom01",
      "AlignBottom02"
    ],
    "tags": [
      "align",
      "bottom",
      "alignbottom01",
      "align bottom 01",
      "alignbottom"
    ]
  },
  {
    "name": "AlignBottom02",
    "label": "Align Bottom 02",
    "category": "Layout",
    "baseFamily": "AlignBottom",
    "isFirstVariant": false,
    "variantCount": 2,
    "familyVariants": [
      "AlignBottom01",
      "AlignBottom02"
    ],
    "tags": [
      "align",
      "bottom",
      "alignbottom02",
      "align bottom 02",
      "alignbottom"
    ]
  },
  {
    "name": "AlignCenter",
    "label": "Align Center",
    "category": "Layout",
    "baseFamily": "AlignCenter",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "AlignCenter"
    ],
    "tags": [
      "align",
      "center",
      "aligncenter",
      "align center"
    ]
  },
  {
    "name": "AlignHorizontalCentre01",
    "label": "Align Horizontal Centre 01",
    "category": "Layout",
    "baseFamily": "AlignHorizontalCentre",
    "isFirstVariant": true,
    "variantCount": 2,
    "familyVariants": [
      "AlignHorizontalCentre01",
      "AlignHorizontalCentre02"
    ],
    "tags": [
      "align",
      "horizontal",
      "centre",
      "alignhorizontalcentre01",
      "align horizontal centre 01",
      "alignhorizontalcentre"
    ]
  },
  {
    "name": "AlignHorizontalCentre02",
    "label": "Align Horizontal Centre 02",
    "category": "Layout",
    "baseFamily": "AlignHorizontalCentre",
    "isFirstVariant": false,
    "variantCount": 2,
    "familyVariants": [
      "AlignHorizontalCentre01",
      "AlignHorizontalCentre02"
    ],
    "tags": [
      "align",
      "horizontal",
      "centre",
      "alignhorizontalcentre02",
      "align horizontal centre 02",
      "alignhorizontalcentre"
    ]
  },
  {
    "name": "AlignJustify",
    "label": "Align Justify",
    "category": "Layout",
    "baseFamily": "AlignJustify",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "AlignJustify"
    ],
    "tags": [
      "align",
      "justify",
      "alignjustify",
      "align justify"
    ]
  },
  {
    "name": "AlignLeft",
    "label": "Align Left",
    "category": "Layout",
    "baseFamily": "AlignLeft",
    "isFirstVariant": false,
    "variantCount": 3,
    "familyVariants": [
      "AlignLeft",
      "AlignLeft01",
      "AlignLeft02"
    ],
    "tags": [
      "align",
      "left",
      "alignleft",
      "align left"
    ]
  },
  {
    "name": "AlignLeft01",
    "label": "Align Left 01",
    "category": "Layout",
    "baseFamily": "AlignLeft",
    "isFirstVariant": true,
    "variantCount": 3,
    "familyVariants": [
      "AlignLeft",
      "AlignLeft01",
      "AlignLeft02"
    ],
    "tags": [
      "align",
      "left",
      "alignleft01",
      "align left 01",
      "alignleft"
    ]
  },
  {
    "name": "AlignLeft02",
    "label": "Align Left 02",
    "category": "Layout",
    "baseFamily": "AlignLeft",
    "isFirstVariant": false,
    "variantCount": 3,
    "familyVariants": [
      "AlignLeft",
      "AlignLeft01",
      "AlignLeft02"
    ],
    "tags": [
      "align",
      "left",
      "alignleft02",
      "align left 02",
      "alignleft"
    ]
  },
  {
    "name": "AlignRight",
    "label": "Align Right",
    "category": "Layout",
    "baseFamily": "AlignRight",
    "isFirstVariant": false,
    "variantCount": 3,
    "familyVariants": [
      "AlignRight",
      "AlignRight01",
      "AlignRight02"
    ],
    "tags": [
      "align",
      "right",
      "alignright",
      "align right"
    ]
  },
  {
    "name": "AlignRight01",
    "label": "Align Right 01",
    "category": "Layout",
    "baseFamily": "AlignRight",
    "isFirstVariant": true,
    "variantCount": 3,
    "familyVariants": [
      "AlignRight",
      "AlignRight01",
      "AlignRight02"
    ],
    "tags": [
      "align",
      "right",
      "alignright01",
      "align right 01",
      "alignright"
    ]
  },
  {
    "name": "AlignRight02",
    "label": "Align Right 02",
    "category": "Layout",
    "baseFamily": "AlignRight",
    "isFirstVariant": false,
    "variantCount": 3,
    "familyVariants": [
      "AlignRight",
      "AlignRight01",
      "AlignRight02"
    ],
    "tags": [
      "align",
      "right",
      "alignright02",
      "align right 02",
      "alignright"
    ]
  },
  {
    "name": "AlignTopArrow01",
    "label": "Align Top Arrow 01",
    "category": "Layout",
    "baseFamily": "AlignTopArrow",
    "isFirstVariant": true,
    "variantCount": 2,
    "familyVariants": [
      "AlignTopArrow01",
      "AlignTopArrow02"
    ],
    "tags": [
      "align",
      "top",
      "arrow",
      "aligntoparrow01",
      "align top arrow 01",
      "aligntoparrow"
    ]
  },
  {
    "name": "AlignTopArrow02",
    "label": "Align Top Arrow 02",
    "category": "Layout",
    "baseFamily": "AlignTopArrow",
    "isFirstVariant": false,
    "variantCount": 2,
    "familyVariants": [
      "AlignTopArrow01",
      "AlignTopArrow02"
    ],
    "tags": [
      "align",
      "top",
      "arrow",
      "aligntoparrow02",
      "align top arrow 02",
      "aligntoparrow"
    ]
  },
  {
    "name": "AlignVerticalCenter01",
    "label": "Align Vertical Center 01",
    "category": "Layout",
    "baseFamily": "AlignVerticalCenter",
    "isFirstVariant": true,
    "variantCount": 2,
    "familyVariants": [
      "AlignVerticalCenter01",
      "AlignVerticalCenter02"
    ],
    "tags": [
      "align",
      "vertical",
      "center",
      "alignverticalcenter01",
      "align vertical center 01",
      "alignverticalcenter"
    ]
  },
  {
    "name": "AlignVerticalCenter02",
    "label": "Align Vertical Center 02",
    "category": "Layout",
    "baseFamily": "AlignVerticalCenter",
    "isFirstVariant": false,
    "variantCount": 2,
    "familyVariants": [
      "AlignVerticalCenter01",
      "AlignVerticalCenter02"
    ],
    "tags": [
      "align",
      "vertical",
      "center",
      "alignverticalcenter02",
      "align vertical center 02",
      "alignverticalcenter"
    ]
  },
  {
    "name": "Anchor",
    "label": "Anchor",
    "category": "Maps & travel",
    "baseFamily": "Anchor",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "Anchor"
    ],
    "tags": [
      "anchor"
    ]
  },
  {
    "name": "Annotation",
    "label": "Annotation",
    "category": "Communication",
    "baseFamily": "Annotation",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "Annotation"
    ],
    "tags": [
      "annotation"
    ]
  },
  {
    "name": "AnnotationAlert",
    "label": "Annotation Alert",
    "category": "Communication",
    "baseFamily": "AnnotationAlert",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "AnnotationAlert"
    ],
    "tags": [
      "annotation",
      "alert",
      "annotationalert",
      "annotation alert"
    ]
  },
  {
    "name": "AnnotationCheck",
    "label": "Annotation Check",
    "category": "Communication",
    "baseFamily": "AnnotationCheck",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "AnnotationCheck"
    ],
    "tags": [
      "annotation",
      "check",
      "annotationcheck",
      "annotation check"
    ]
  },
  {
    "name": "AnnotationDots",
    "label": "Annotation Dots",
    "category": "Communication",
    "baseFamily": "AnnotationDots",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "AnnotationDots"
    ],
    "tags": [
      "annotation",
      "dots",
      "annotationdots",
      "annotation dots"
    ]
  },
  {
    "name": "AnnotationHeart",
    "label": "Annotation Heart",
    "category": "Communication",
    "baseFamily": "AnnotationHeart",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "AnnotationHeart"
    ],
    "tags": [
      "annotation",
      "heart",
      "annotationheart",
      "annotation heart"
    ]
  },
  {
    "name": "AnnotationInfo",
    "label": "Annotation Info",
    "category": "Communication",
    "baseFamily": "AnnotationInfo",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "AnnotationInfo"
    ],
    "tags": [
      "annotation",
      "info",
      "annotationinfo",
      "annotation info"
    ]
  },
  {
    "name": "AnnotationPlus",
    "label": "Annotation Plus",
    "category": "Communication",
    "baseFamily": "AnnotationPlus",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "AnnotationPlus"
    ],
    "tags": [
      "annotation",
      "plus",
      "annotationplus",
      "annotation plus"
    ]
  },
  {
    "name": "AnnotationQuestion",
    "label": "Annotation Question",
    "category": "Communication",
    "baseFamily": "AnnotationQuestion",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "AnnotationQuestion"
    ],
    "tags": [
      "annotation",
      "question",
      "annotationquestion",
      "annotation question"
    ]
  },
  {
    "name": "AnnotationX",
    "label": "Annotation X",
    "category": "Communication",
    "baseFamily": "AnnotationX",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "AnnotationX"
    ],
    "tags": [
      "annotation",
      "x",
      "annotationx",
      "annotation x"
    ]
  },
  {
    "name": "Announcement01",
    "label": "Announcement 01",
    "category": "Communication",
    "baseFamily": "Announcement",
    "isFirstVariant": true,
    "variantCount": 3,
    "familyVariants": [
      "Announcement01",
      "Announcement02",
      "Announcement03"
    ],
    "tags": [
      "announcement",
      "announcement01",
      "announcement 01"
    ]
  },
  {
    "name": "Announcement02",
    "label": "Announcement 02",
    "category": "Communication",
    "baseFamily": "Announcement",
    "isFirstVariant": false,
    "variantCount": 3,
    "familyVariants": [
      "Announcement01",
      "Announcement02",
      "Announcement03"
    ],
    "tags": [
      "announcement",
      "announcement02",
      "announcement 02"
    ]
  },
  {
    "name": "Announcement03",
    "label": "Announcement 03",
    "category": "Communication",
    "baseFamily": "Announcement",
    "isFirstVariant": false,
    "variantCount": 3,
    "familyVariants": [
      "Announcement01",
      "Announcement02",
      "Announcement03"
    ],
    "tags": [
      "announcement",
      "announcement03",
      "announcement 03"
    ]
  },
  {
    "name": "Archive",
    "label": "Archive",
    "category": "Files",
    "baseFamily": "Archive",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "Archive"
    ],
    "tags": [
      "archive"
    ]
  },
  {
    "name": "ArrowBlockDown",
    "label": "Arrow Block Down",
    "category": "Arrows",
    "baseFamily": "ArrowBlockDown",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "ArrowBlockDown"
    ],
    "tags": [
      "arrow",
      "block",
      "down",
      "arrowblockdown",
      "arrow block down"
    ]
  },
  {
    "name": "ArrowBlockLeft",
    "label": "Arrow Block Left",
    "category": "Arrows",
    "baseFamily": "ArrowBlockLeft",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "ArrowBlockLeft"
    ],
    "tags": [
      "arrow",
      "block",
      "left",
      "arrowblockleft",
      "arrow block left"
    ]
  },
  {
    "name": "ArrowBlockRight",
    "label": "Arrow Block Right",
    "category": "Arrows",
    "baseFamily": "ArrowBlockRight",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "ArrowBlockRight"
    ],
    "tags": [
      "arrow",
      "block",
      "right",
      "arrowblockright",
      "arrow block right"
    ]
  },
  {
    "name": "ArrowBlockUp",
    "label": "Arrow Block Up",
    "category": "Arrows",
    "baseFamily": "ArrowBlockUp",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "ArrowBlockUp"
    ],
    "tags": [
      "arrow",
      "block",
      "up",
      "arrowblockup",
      "arrow block up"
    ]
  },
  {
    "name": "ArrowCircleBrokenDown",
    "label": "Arrow Circle Broken Down",
    "category": "Arrows",
    "baseFamily": "ArrowCircleBrokenDown",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "ArrowCircleBrokenDown"
    ],
    "tags": [
      "arrow",
      "circle",
      "broken",
      "down",
      "arrowcirclebrokendown",
      "arrow circle broken down"
    ]
  },
  {
    "name": "ArrowCircleBrokenDownLeft",
    "label": "Arrow Circle Broken Down Left",
    "category": "Arrows",
    "baseFamily": "ArrowCircleBrokenDownLeft",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "ArrowCircleBrokenDownLeft"
    ],
    "tags": [
      "arrow",
      "circle",
      "broken",
      "down",
      "left",
      "arrowcirclebrokendownleft",
      "arrow circle broken down left"
    ]
  },
  {
    "name": "ArrowCircleBrokenDownRight",
    "label": "Arrow Circle Broken Down Right",
    "category": "Arrows",
    "baseFamily": "ArrowCircleBrokenDownRight",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "ArrowCircleBrokenDownRight"
    ],
    "tags": [
      "arrow",
      "circle",
      "broken",
      "down",
      "right",
      "arrowcirclebrokendownright",
      "arrow circle broken down right"
    ]
  },
  {
    "name": "ArrowCircleBrokenLeft",
    "label": "Arrow Circle Broken Left",
    "category": "Arrows",
    "baseFamily": "ArrowCircleBrokenLeft",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "ArrowCircleBrokenLeft"
    ],
    "tags": [
      "arrow",
      "circle",
      "broken",
      "left",
      "arrowcirclebrokenleft",
      "arrow circle broken left"
    ]
  },
  {
    "name": "ArrowCircleBrokenRight",
    "label": "Arrow Circle Broken Right",
    "category": "Arrows",
    "baseFamily": "ArrowCircleBrokenRight",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "ArrowCircleBrokenRight"
    ],
    "tags": [
      "arrow",
      "circle",
      "broken",
      "right",
      "arrowcirclebrokenright",
      "arrow circle broken right"
    ]
  },
  {
    "name": "ArrowCircleBrokenUp",
    "label": "Arrow Circle Broken Up",
    "category": "Arrows",
    "baseFamily": "ArrowCircleBrokenUp",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "ArrowCircleBrokenUp"
    ],
    "tags": [
      "arrow",
      "circle",
      "broken",
      "up",
      "arrowcirclebrokenup",
      "arrow circle broken up"
    ]
  },
  {
    "name": "ArrowCircleBrokenUpLeft",
    "label": "Arrow Circle Broken Up Left",
    "category": "Arrows",
    "baseFamily": "ArrowCircleBrokenUpLeft",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "ArrowCircleBrokenUpLeft"
    ],
    "tags": [
      "arrow",
      "circle",
      "broken",
      "up",
      "left",
      "arrowcirclebrokenupleft",
      "arrow circle broken up left"
    ]
  },
  {
    "name": "ArrowCircleBrokenUpRight",
    "label": "Arrow Circle Broken Up Right",
    "category": "Arrows",
    "baseFamily": "ArrowCircleBrokenUpRight",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "ArrowCircleBrokenUpRight"
    ],
    "tags": [
      "arrow",
      "circle",
      "broken",
      "up",
      "right",
      "arrowcirclebrokenupright",
      "arrow circle broken up right"
    ]
  },
  {
    "name": "ArrowCircleDown",
    "label": "Arrow Circle Down",
    "category": "Arrows",
    "baseFamily": "ArrowCircleDown",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "ArrowCircleDown"
    ],
    "tags": [
      "arrow",
      "circle",
      "down",
      "arrowcircledown",
      "arrow circle down"
    ]
  },
  {
    "name": "ArrowCircleDownLeft",
    "label": "Arrow Circle Down Left",
    "category": "Arrows",
    "baseFamily": "ArrowCircleDownLeft",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "ArrowCircleDownLeft"
    ],
    "tags": [
      "arrow",
      "circle",
      "down",
      "left",
      "arrowcircledownleft",
      "arrow circle down left"
    ]
  },
  {
    "name": "ArrowCircleDownRight",
    "label": "Arrow Circle Down Right",
    "category": "Arrows",
    "baseFamily": "ArrowCircleDownRight",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "ArrowCircleDownRight"
    ],
    "tags": [
      "arrow",
      "circle",
      "down",
      "right",
      "arrowcircledownright",
      "arrow circle down right"
    ]
  },
  {
    "name": "ArrowCircleLeft",
    "label": "Arrow Circle Left",
    "category": "Arrows",
    "baseFamily": "ArrowCircleLeft",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "ArrowCircleLeft"
    ],
    "tags": [
      "arrow",
      "circle",
      "left",
      "arrowcircleleft",
      "arrow circle left"
    ]
  },
  {
    "name": "ArrowCircleRight",
    "label": "Arrow Circle Right",
    "category": "Arrows",
    "baseFamily": "ArrowCircleRight",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "ArrowCircleRight"
    ],
    "tags": [
      "arrow",
      "circle",
      "right",
      "arrowcircleright",
      "arrow circle right"
    ]
  },
  {
    "name": "ArrowCircleUp",
    "label": "Arrow Circle Up",
    "category": "Arrows",
    "baseFamily": "ArrowCircleUp",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "ArrowCircleUp"
    ],
    "tags": [
      "arrow",
      "circle",
      "up",
      "arrowcircleup",
      "arrow circle up"
    ]
  },
  {
    "name": "ArrowCircleUpLeft",
    "label": "Arrow Circle Up Left",
    "category": "Arrows",
    "baseFamily": "ArrowCircleUpLeft",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "ArrowCircleUpLeft"
    ],
    "tags": [
      "arrow",
      "circle",
      "up",
      "left",
      "arrowcircleupleft",
      "arrow circle up left"
    ]
  },
  {
    "name": "ArrowCircleUpRight",
    "label": "Arrow Circle Up Right",
    "category": "Arrows",
    "baseFamily": "ArrowCircleUpRight",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "ArrowCircleUpRight"
    ],
    "tags": [
      "arrow",
      "circle",
      "up",
      "right",
      "arrowcircleupright",
      "arrow circle up right"
    ]
  },
  {
    "name": "ArrowDown",
    "label": "Arrow Down",
    "category": "Arrows",
    "baseFamily": "ArrowDown",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "ArrowDown"
    ],
    "tags": [
      "arrow",
      "down",
      "arrowdown",
      "arrow down"
    ]
  },
  {
    "name": "ArrowDownLeft",
    "label": "Arrow Down Left",
    "category": "Arrows",
    "baseFamily": "ArrowDownLeft",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "ArrowDownLeft"
    ],
    "tags": [
      "arrow",
      "down",
      "left",
      "arrowdownleft",
      "arrow down left"
    ]
  },
  {
    "name": "ArrowDownRight",
    "label": "Arrow Down Right",
    "category": "Arrows",
    "baseFamily": "ArrowDownRight",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "ArrowDownRight"
    ],
    "tags": [
      "arrow",
      "down",
      "right",
      "arrowdownright",
      "arrow down right"
    ]
  },
  {
    "name": "ArrowLeft",
    "label": "Arrow Left",
    "category": "Arrows",
    "baseFamily": "ArrowLeft",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "ArrowLeft"
    ],
    "tags": [
      "arrow",
      "left",
      "arrowleft",
      "arrow left"
    ]
  },
  {
    "name": "ArrowNarrowDown",
    "label": "Arrow Narrow Down",
    "category": "Arrows",
    "baseFamily": "ArrowNarrowDown",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "ArrowNarrowDown"
    ],
    "tags": [
      "arrow",
      "narrow",
      "down",
      "arrownarrowdown",
      "arrow narrow down"
    ]
  },
  {
    "name": "ArrowNarrowDownLeft",
    "label": "Arrow Narrow Down Left",
    "category": "Arrows",
    "baseFamily": "ArrowNarrowDownLeft",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "ArrowNarrowDownLeft"
    ],
    "tags": [
      "arrow",
      "narrow",
      "down",
      "left",
      "arrownarrowdownleft",
      "arrow narrow down left"
    ]
  },
  {
    "name": "ArrowNarrowDownRight",
    "label": "Arrow Narrow Down Right",
    "category": "Arrows",
    "baseFamily": "ArrowNarrowDownRight",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "ArrowNarrowDownRight"
    ],
    "tags": [
      "arrow",
      "narrow",
      "down",
      "right",
      "arrownarrowdownright",
      "arrow narrow down right"
    ]
  },
  {
    "name": "ArrowNarrowLeft",
    "label": "Arrow Narrow Left",
    "category": "Arrows",
    "baseFamily": "ArrowNarrowLeft",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "ArrowNarrowLeft"
    ],
    "tags": [
      "arrow",
      "narrow",
      "left",
      "arrownarrowleft",
      "arrow narrow left"
    ]
  },
  {
    "name": "ArrowNarrowRight",
    "label": "Arrow Narrow Right",
    "category": "Arrows",
    "baseFamily": "ArrowNarrowRight",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "ArrowNarrowRight"
    ],
    "tags": [
      "arrow",
      "narrow",
      "right",
      "arrownarrowright",
      "arrow narrow right"
    ]
  },
  {
    "name": "ArrowNarrowUp",
    "label": "Arrow Narrow Up",
    "category": "Arrows",
    "baseFamily": "ArrowNarrowUp",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "ArrowNarrowUp"
    ],
    "tags": [
      "arrow",
      "narrow",
      "up",
      "arrownarrowup",
      "arrow narrow up"
    ]
  },
  {
    "name": "ArrowNarrowUpLeft",
    "label": "Arrow Narrow Up Left",
    "category": "Arrows",
    "baseFamily": "ArrowNarrowUpLeft",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "ArrowNarrowUpLeft"
    ],
    "tags": [
      "arrow",
      "narrow",
      "up",
      "left",
      "arrownarrowupleft",
      "arrow narrow up left"
    ]
  },
  {
    "name": "ArrowNarrowUpRight",
    "label": "Arrow Narrow Up Right",
    "category": "Arrows",
    "baseFamily": "ArrowNarrowUpRight",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "ArrowNarrowUpRight"
    ],
    "tags": [
      "arrow",
      "narrow",
      "up",
      "right",
      "arrownarrowupright",
      "arrow narrow up right"
    ]
  },
  {
    "name": "ArrowNext",
    "label": "Arrow Next",
    "category": "Arrows",
    "baseFamily": "ArrowNext",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "ArrowNext"
    ],
    "tags": [
      "arrow",
      "next",
      "arrownext",
      "arrow next"
    ]
  },
  {
    "name": "ArrowPrevious",
    "label": "Arrow Previous",
    "category": "Arrows",
    "baseFamily": "ArrowPrevious",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "ArrowPrevious"
    ],
    "tags": [
      "arrow",
      "previous",
      "arrowprevious",
      "arrow previous"
    ]
  },
  {
    "name": "ArrowRight",
    "label": "Arrow Right",
    "category": "Arrows",
    "baseFamily": "ArrowRight",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "ArrowRight"
    ],
    "tags": [
      "arrow",
      "right",
      "arrowright",
      "arrow right"
    ]
  },
  {
    "name": "ArrowSquareDown",
    "label": "Arrow Square Down",
    "category": "Arrows",
    "baseFamily": "ArrowSquareDown",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "ArrowSquareDown"
    ],
    "tags": [
      "arrow",
      "square",
      "down",
      "arrowsquaredown",
      "arrow square down"
    ]
  },
  {
    "name": "ArrowSquareDownLeft",
    "label": "Arrow Square Down Left",
    "category": "Arrows",
    "baseFamily": "ArrowSquareDownLeft",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "ArrowSquareDownLeft"
    ],
    "tags": [
      "arrow",
      "square",
      "down",
      "left",
      "arrowsquaredownleft",
      "arrow square down left"
    ]
  },
  {
    "name": "ArrowSquareDownRight",
    "label": "Arrow Square Down Right",
    "category": "Arrows",
    "baseFamily": "ArrowSquareDownRight",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "ArrowSquareDownRight"
    ],
    "tags": [
      "arrow",
      "square",
      "down",
      "right",
      "arrowsquaredownright",
      "arrow square down right"
    ]
  },
  {
    "name": "ArrowSquareLeft",
    "label": "Arrow Square Left",
    "category": "Arrows",
    "baseFamily": "ArrowSquareLeft",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "ArrowSquareLeft"
    ],
    "tags": [
      "arrow",
      "square",
      "left",
      "arrowsquareleft",
      "arrow square left"
    ]
  },
  {
    "name": "ArrowSquareRight",
    "label": "Arrow Square Right",
    "category": "Arrows",
    "baseFamily": "ArrowSquareRight",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "ArrowSquareRight"
    ],
    "tags": [
      "arrow",
      "square",
      "right",
      "arrowsquareright",
      "arrow square right"
    ]
  },
  {
    "name": "ArrowSquareUp",
    "label": "Arrow Square Up",
    "category": "Arrows",
    "baseFamily": "ArrowSquareUp",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "ArrowSquareUp"
    ],
    "tags": [
      "arrow",
      "square",
      "up",
      "arrowsquareup",
      "arrow square up"
    ]
  },
  {
    "name": "ArrowSquareUpLeft",
    "label": "Arrow Square Up Left",
    "category": "Arrows",
    "baseFamily": "ArrowSquareUpLeft",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "ArrowSquareUpLeft"
    ],
    "tags": [
      "arrow",
      "square",
      "up",
      "left",
      "arrowsquareupleft",
      "arrow square up left"
    ]
  },
  {
    "name": "ArrowSquareUpRight",
    "label": "Arrow Square Up Right",
    "category": "Arrows",
    "baseFamily": "ArrowSquareUpRight",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "ArrowSquareUpRight"
    ],
    "tags": [
      "arrow",
      "square",
      "up",
      "right",
      "arrowsquareupright",
      "arrow square up right"
    ]
  },
  {
    "name": "ArrowUp",
    "label": "Arrow Up",
    "category": "Arrows",
    "baseFamily": "ArrowUp",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "ArrowUp"
    ],
    "tags": [
      "arrow",
      "up",
      "arrowup",
      "arrow up"
    ]
  },
  {
    "name": "ArrowUpLeft",
    "label": "Arrow Up Left",
    "category": "Arrows",
    "baseFamily": "ArrowUpLeft",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "ArrowUpLeft"
    ],
    "tags": [
      "arrow",
      "up",
      "left",
      "arrowupleft",
      "arrow up left"
    ]
  },
  {
    "name": "ArrowUpRight",
    "label": "Arrow Up Right",
    "category": "Arrows",
    "baseFamily": "ArrowUpRight",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "ArrowUpRight"
    ],
    "tags": [
      "arrow",
      "up",
      "right",
      "arrowupright",
      "arrow up right"
    ]
  },
  {
    "name": "ArrowsDown",
    "label": "Arrows Down",
    "category": "Arrows",
    "baseFamily": "ArrowsDown",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "ArrowsDown"
    ],
    "tags": [
      "arrows",
      "down",
      "arrowsdown",
      "arrows down"
    ]
  },
  {
    "name": "ArrowsLeft",
    "label": "Arrows Left",
    "category": "Arrows",
    "baseFamily": "ArrowsLeft",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "ArrowsLeft"
    ],
    "tags": [
      "arrows",
      "left",
      "arrowsleft",
      "arrows left"
    ]
  },
  {
    "name": "ArrowsRight",
    "label": "Arrows Right",
    "category": "Arrows",
    "baseFamily": "ArrowsRight",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "ArrowsRight"
    ],
    "tags": [
      "arrows",
      "right",
      "arrowsright",
      "arrows right"
    ]
  },
  {
    "name": "ArrowsTriangle",
    "label": "Arrows Triangle",
    "category": "Arrows",
    "baseFamily": "ArrowsTriangle",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "ArrowsTriangle"
    ],
    "tags": [
      "arrows",
      "triangle",
      "arrowstriangle",
      "arrows triangle"
    ]
  },
  {
    "name": "ArrowsUp",
    "label": "Arrows Up",
    "category": "Arrows",
    "baseFamily": "ArrowsUp",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "ArrowsUp"
    ],
    "tags": [
      "arrows",
      "up",
      "arrowsup",
      "arrows up"
    ]
  },
  {
    "name": "Asterisk01",
    "label": "Asterisk 01",
    "category": "Alerts & feedback",
    "baseFamily": "Asterisk",
    "isFirstVariant": true,
    "variantCount": 2,
    "familyVariants": [
      "Asterisk01",
      "Asterisk02"
    ],
    "tags": [
      "asterisk",
      "asterisk01",
      "asterisk 01"
    ]
  },
  {
    "name": "Asterisk02",
    "label": "Asterisk 02",
    "category": "Alerts & feedback",
    "baseFamily": "Asterisk",
    "isFirstVariant": false,
    "variantCount": 2,
    "familyVariants": [
      "Asterisk01",
      "Asterisk02"
    ],
    "tags": [
      "asterisk",
      "asterisk02",
      "asterisk 02"
    ]
  },
  {
    "name": "AtSign",
    "label": "At Sign",
    "category": "Communication",
    "baseFamily": "AtSign",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "AtSign"
    ],
    "tags": [
      "at",
      "sign",
      "atsign",
      "at sign"
    ]
  },
  {
    "name": "Atom01",
    "label": "Atom 01",
    "category": "Education",
    "baseFamily": "Atom",
    "isFirstVariant": true,
    "variantCount": 2,
    "familyVariants": [
      "Atom01",
      "Atom02"
    ],
    "tags": [
      "atom",
      "atom01",
      "atom 01"
    ]
  },
  {
    "name": "Atom02",
    "label": "Atom 02",
    "category": "Education",
    "baseFamily": "Atom",
    "isFirstVariant": false,
    "variantCount": 2,
    "familyVariants": [
      "Atom01",
      "Atom02"
    ],
    "tags": [
      "atom",
      "atom02",
      "atom 02"
    ]
  },
  {
    "name": "Attachment01",
    "label": "Attachment 01",
    "category": "Files",
    "baseFamily": "Attachment",
    "isFirstVariant": true,
    "variantCount": 2,
    "familyVariants": [
      "Attachment01",
      "Attachment02"
    ],
    "tags": [
      "attachment",
      "attachment01",
      "attachment 01"
    ]
  },
  {
    "name": "Attachment02",
    "label": "Attachment 02",
    "category": "Files",
    "baseFamily": "Attachment",
    "isFirstVariant": false,
    "variantCount": 2,
    "familyVariants": [
      "Attachment01",
      "Attachment02"
    ],
    "tags": [
      "attachment",
      "attachment02",
      "attachment 02"
    ]
  },
  {
    "name": "Award01",
    "label": "Award 01",
    "category": "Finance & eCommerce",
    "baseFamily": "Award",
    "isFirstVariant": true,
    "variantCount": 5,
    "familyVariants": [
      "Award01",
      "Award02",
      "Award03",
      "Award04",
      "Award05"
    ],
    "tags": [
      "award",
      "badge",
      "medal",
      "achievement",
      "certificate",
      "honor",
      "rank",
      "award01",
      "award 01"
    ]
  },
  {
    "name": "Award02",
    "label": "Award 02",
    "category": "Finance & eCommerce",
    "baseFamily": "Award",
    "isFirstVariant": false,
    "variantCount": 5,
    "familyVariants": [
      "Award01",
      "Award02",
      "Award03",
      "Award04",
      "Award05"
    ],
    "tags": [
      "award",
      "badge",
      "medal",
      "achievement",
      "certificate",
      "honor",
      "award02",
      "award 02"
    ]
  },
  {
    "name": "Award03",
    "label": "Award 03",
    "category": "Finance & eCommerce",
    "baseFamily": "Award",
    "isFirstVariant": false,
    "variantCount": 5,
    "familyVariants": [
      "Award01",
      "Award02",
      "Award03",
      "Award04",
      "Award05"
    ],
    "tags": [
      "award",
      "badge",
      "medal",
      "achievement",
      "certificate",
      "honor",
      "award03",
      "award 03"
    ]
  },
  {
    "name": "Award04",
    "label": "Award 04",
    "category": "Finance & eCommerce",
    "baseFamily": "Award",
    "isFirstVariant": false,
    "variantCount": 5,
    "familyVariants": [
      "Award01",
      "Award02",
      "Award03",
      "Award04",
      "Award05"
    ],
    "tags": [
      "award",
      "badge",
      "medal",
      "achievement",
      "certificate",
      "honor",
      "award04",
      "award 04"
    ]
  },
  {
    "name": "Award05",
    "label": "Award 05",
    "category": "Finance & eCommerce",
    "baseFamily": "Award",
    "isFirstVariant": false,
    "variantCount": 5,
    "familyVariants": [
      "Award01",
      "Award02",
      "Award03",
      "Award04",
      "Award05"
    ],
    "tags": [
      "award",
      "badge",
      "medal",
      "achievement",
      "certificate",
      "honor",
      "award05",
      "award 05"
    ]
  },
  {
    "name": "Backpack",
    "label": "Backpack",
    "category": "Education",
    "baseFamily": "Backpack",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "Backpack"
    ],
    "tags": [
      "backpack"
    ]
  },
  {
    "name": "Bank",
    "label": "Bank",
    "category": "Finance & eCommerce",
    "baseFamily": "Bank",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "Bank"
    ],
    "tags": [
      "bank",
      "institution",
      "checking",
      "vault",
      "finance",
      "depot",
      "atm",
      "federal"
    ]
  },
  {
    "name": "BankNote01",
    "label": "Bank Note 01",
    "category": "Finance & eCommerce",
    "baseFamily": "BankNote",
    "isFirstVariant": true,
    "variantCount": 3,
    "familyVariants": [
      "BankNote01",
      "BankNote02",
      "BankNote03"
    ],
    "tags": [
      "bank",
      "note",
      "cash",
      "paper money",
      "dollar",
      "euro",
      "bill",
      "currency",
      "payment",
      "salary",
      "income",
      "banknote01",
      "bank note 01",
      "banknote"
    ]
  },
  {
    "name": "BankNote02",
    "label": "Bank Note 02",
    "category": "Finance & eCommerce",
    "baseFamily": "BankNote",
    "isFirstVariant": false,
    "variantCount": 3,
    "familyVariants": [
      "BankNote01",
      "BankNote02",
      "BankNote03"
    ],
    "tags": [
      "bank",
      "note",
      "cash",
      "paper money",
      "dollar",
      "euro",
      "bill",
      "currency",
      "payment",
      "salary",
      "income",
      "banknote02",
      "bank note 02",
      "banknote"
    ]
  },
  {
    "name": "BankNote03",
    "label": "Bank Note 03",
    "category": "Finance & eCommerce",
    "baseFamily": "BankNote",
    "isFirstVariant": false,
    "variantCount": 3,
    "familyVariants": [
      "BankNote01",
      "BankNote02",
      "BankNote03"
    ],
    "tags": [
      "bank",
      "note",
      "cash",
      "paper money",
      "dollar",
      "euro",
      "bill",
      "currency",
      "payment",
      "salary",
      "income",
      "banknote03",
      "bank note 03",
      "banknote"
    ]
  },
  {
    "name": "BarChart01",
    "label": "Bar Chart 01",
    "category": "Charts",
    "baseFamily": "BarChart",
    "isFirstVariant": true,
    "variantCount": 12,
    "familyVariants": [
      "BarChart01",
      "BarChart02",
      "BarChart03",
      "BarChart04",
      "BarChart05",
      "BarChart06",
      "BarChart07",
      "BarChart08",
      "BarChart09",
      "BarChart10",
      "BarChart11",
      "BarChart12"
    ],
    "tags": [
      "bar",
      "chart",
      "histogram",
      "statistics",
      "metrics",
      "analytics",
      "data",
      "reports",
      "overview",
      "barchart01",
      "bar chart 01",
      "barchart"
    ]
  },
  {
    "name": "BarChart02",
    "label": "Bar Chart 02",
    "category": "Charts",
    "baseFamily": "BarChart",
    "isFirstVariant": false,
    "variantCount": 12,
    "familyVariants": [
      "BarChart01",
      "BarChart02",
      "BarChart03",
      "BarChart04",
      "BarChart05",
      "BarChart06",
      "BarChart07",
      "BarChart08",
      "BarChart09",
      "BarChart10",
      "BarChart11",
      "BarChart12"
    ],
    "tags": [
      "bar",
      "chart",
      "histogram",
      "statistics",
      "metrics",
      "analytics",
      "data",
      "reports",
      "barchart02",
      "bar chart 02",
      "barchart"
    ]
  },
  {
    "name": "BarChart03",
    "label": "Bar Chart 03",
    "category": "Charts",
    "baseFamily": "BarChart",
    "isFirstVariant": false,
    "variantCount": 12,
    "familyVariants": [
      "BarChart01",
      "BarChart02",
      "BarChart03",
      "BarChart04",
      "BarChart05",
      "BarChart06",
      "BarChart07",
      "BarChart08",
      "BarChart09",
      "BarChart10",
      "BarChart11",
      "BarChart12"
    ],
    "tags": [
      "bar",
      "chart",
      "barchart03",
      "bar chart 03",
      "barchart"
    ]
  },
  {
    "name": "BarChart04",
    "label": "Bar Chart 04",
    "category": "Charts",
    "baseFamily": "BarChart",
    "isFirstVariant": false,
    "variantCount": 12,
    "familyVariants": [
      "BarChart01",
      "BarChart02",
      "BarChart03",
      "BarChart04",
      "BarChart05",
      "BarChart06",
      "BarChart07",
      "BarChart08",
      "BarChart09",
      "BarChart10",
      "BarChart11",
      "BarChart12"
    ],
    "tags": [
      "bar",
      "chart",
      "barchart04",
      "bar chart 04",
      "barchart"
    ]
  },
  {
    "name": "BarChart05",
    "label": "Bar Chart 05",
    "category": "Charts",
    "baseFamily": "BarChart",
    "isFirstVariant": false,
    "variantCount": 12,
    "familyVariants": [
      "BarChart01",
      "BarChart02",
      "BarChart03",
      "BarChart04",
      "BarChart05",
      "BarChart06",
      "BarChart07",
      "BarChart08",
      "BarChart09",
      "BarChart10",
      "BarChart11",
      "BarChart12"
    ],
    "tags": [
      "bar",
      "chart",
      "barchart05",
      "bar chart 05",
      "barchart"
    ]
  },
  {
    "name": "BarChart06",
    "label": "Bar Chart 06",
    "category": "Charts",
    "baseFamily": "BarChart",
    "isFirstVariant": false,
    "variantCount": 12,
    "familyVariants": [
      "BarChart01",
      "BarChart02",
      "BarChart03",
      "BarChart04",
      "BarChart05",
      "BarChart06",
      "BarChart07",
      "BarChart08",
      "BarChart09",
      "BarChart10",
      "BarChart11",
      "BarChart12"
    ],
    "tags": [
      "bar",
      "chart",
      "barchart06",
      "bar chart 06",
      "barchart"
    ]
  },
  {
    "name": "BarChart07",
    "label": "Bar Chart 07",
    "category": "Charts",
    "baseFamily": "BarChart",
    "isFirstVariant": false,
    "variantCount": 12,
    "familyVariants": [
      "BarChart01",
      "BarChart02",
      "BarChart03",
      "BarChart04",
      "BarChart05",
      "BarChart06",
      "BarChart07",
      "BarChart08",
      "BarChart09",
      "BarChart10",
      "BarChart11",
      "BarChart12"
    ],
    "tags": [
      "bar",
      "chart",
      "barchart07",
      "bar chart 07",
      "barchart"
    ]
  },
  {
    "name": "BarChart08",
    "label": "Bar Chart 08",
    "category": "Charts",
    "baseFamily": "BarChart",
    "isFirstVariant": false,
    "variantCount": 12,
    "familyVariants": [
      "BarChart01",
      "BarChart02",
      "BarChart03",
      "BarChart04",
      "BarChart05",
      "BarChart06",
      "BarChart07",
      "BarChart08",
      "BarChart09",
      "BarChart10",
      "BarChart11",
      "BarChart12"
    ],
    "tags": [
      "bar",
      "chart",
      "barchart08",
      "bar chart 08",
      "barchart"
    ]
  },
  {
    "name": "BarChart09",
    "label": "Bar Chart 09",
    "category": "Charts",
    "baseFamily": "BarChart",
    "isFirstVariant": false,
    "variantCount": 12,
    "familyVariants": [
      "BarChart01",
      "BarChart02",
      "BarChart03",
      "BarChart04",
      "BarChart05",
      "BarChart06",
      "BarChart07",
      "BarChart08",
      "BarChart09",
      "BarChart10",
      "BarChart11",
      "BarChart12"
    ],
    "tags": [
      "bar",
      "chart",
      "barchart09",
      "bar chart 09",
      "barchart"
    ]
  },
  {
    "name": "BarChart10",
    "label": "Bar Chart 10",
    "category": "Charts",
    "baseFamily": "BarChart",
    "isFirstVariant": false,
    "variantCount": 12,
    "familyVariants": [
      "BarChart01",
      "BarChart02",
      "BarChart03",
      "BarChart04",
      "BarChart05",
      "BarChart06",
      "BarChart07",
      "BarChart08",
      "BarChart09",
      "BarChart10",
      "BarChart11",
      "BarChart12"
    ],
    "tags": [
      "bar",
      "chart",
      "barchart10",
      "bar chart 10",
      "barchart"
    ]
  },
  {
    "name": "BarChart11",
    "label": "Bar Chart 11",
    "category": "Charts",
    "baseFamily": "BarChart",
    "isFirstVariant": false,
    "variantCount": 12,
    "familyVariants": [
      "BarChart01",
      "BarChart02",
      "BarChart03",
      "BarChart04",
      "BarChart05",
      "BarChart06",
      "BarChart07",
      "BarChart08",
      "BarChart09",
      "BarChart10",
      "BarChart11",
      "BarChart12"
    ],
    "tags": [
      "bar",
      "chart",
      "barchart11",
      "bar chart 11",
      "barchart"
    ]
  },
  {
    "name": "BarChart12",
    "label": "Bar Chart 12",
    "category": "Charts",
    "baseFamily": "BarChart",
    "isFirstVariant": false,
    "variantCount": 12,
    "familyVariants": [
      "BarChart01",
      "BarChart02",
      "BarChart03",
      "BarChart04",
      "BarChart05",
      "BarChart06",
      "BarChart07",
      "BarChart08",
      "BarChart09",
      "BarChart10",
      "BarChart11",
      "BarChart12"
    ],
    "tags": [
      "bar",
      "chart",
      "barchart12",
      "bar chart 12",
      "barchart"
    ]
  },
  {
    "name": "BarChartCircle01",
    "label": "Bar Chart Circle 01",
    "category": "Charts",
    "baseFamily": "BarChartCircle",
    "isFirstVariant": true,
    "variantCount": 3,
    "familyVariants": [
      "BarChartCircle01",
      "BarChartCircle02",
      "BarChartCircle03"
    ],
    "tags": [
      "bar",
      "chart",
      "circle",
      "barchartcircle01",
      "bar chart circle 01",
      "barchartcircle"
    ]
  },
  {
    "name": "BarChartCircle02",
    "label": "Bar Chart Circle 02",
    "category": "Charts",
    "baseFamily": "BarChartCircle",
    "isFirstVariant": false,
    "variantCount": 3,
    "familyVariants": [
      "BarChartCircle01",
      "BarChartCircle02",
      "BarChartCircle03"
    ],
    "tags": [
      "bar",
      "chart",
      "circle",
      "barchartcircle02",
      "bar chart circle 02",
      "barchartcircle"
    ]
  },
  {
    "name": "BarChartCircle03",
    "label": "Bar Chart Circle 03",
    "category": "Charts",
    "baseFamily": "BarChartCircle",
    "isFirstVariant": false,
    "variantCount": 3,
    "familyVariants": [
      "BarChartCircle01",
      "BarChartCircle02",
      "BarChartCircle03"
    ],
    "tags": [
      "bar",
      "chart",
      "circle",
      "barchartcircle03",
      "bar chart circle 03",
      "barchartcircle"
    ]
  },
  {
    "name": "BarChartSquare01",
    "label": "Bar Chart Square 01",
    "category": "Charts",
    "baseFamily": "BarChartSquare",
    "isFirstVariant": true,
    "variantCount": 3,
    "familyVariants": [
      "BarChartSquare01",
      "BarChartSquare02",
      "BarChartSquare03"
    ],
    "tags": [
      "bar",
      "chart",
      "square",
      "barchartsquare01",
      "bar chart square 01",
      "barchartsquare"
    ]
  },
  {
    "name": "BarChartSquare02",
    "label": "Bar Chart Square 02",
    "category": "Charts",
    "baseFamily": "BarChartSquare",
    "isFirstVariant": false,
    "variantCount": 3,
    "familyVariants": [
      "BarChartSquare01",
      "BarChartSquare02",
      "BarChartSquare03"
    ],
    "tags": [
      "bar",
      "chart",
      "square",
      "barchartsquare02",
      "bar chart square 02",
      "barchartsquare"
    ]
  },
  {
    "name": "BarChartSquare03",
    "label": "Bar Chart Square 03",
    "category": "Charts",
    "baseFamily": "BarChartSquare",
    "isFirstVariant": false,
    "variantCount": 3,
    "familyVariants": [
      "BarChartSquare01",
      "BarChartSquare02",
      "BarChartSquare03"
    ],
    "tags": [
      "bar",
      "chart",
      "square",
      "barchartsquare03",
      "bar chart square 03",
      "barchartsquare"
    ]
  },
  {
    "name": "BarChartSquareDown",
    "label": "Bar Chart Square Down",
    "category": "Charts",
    "baseFamily": "BarChartSquareDown",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "BarChartSquareDown"
    ],
    "tags": [
      "bar",
      "chart",
      "square",
      "down",
      "barchartsquaredown",
      "bar chart square down"
    ]
  },
  {
    "name": "BarChartSquareMinus",
    "label": "Bar Chart Square Minus",
    "category": "Charts",
    "baseFamily": "BarChartSquareMinus",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "BarChartSquareMinus"
    ],
    "tags": [
      "bar",
      "chart",
      "square",
      "minus",
      "barchartsquareminus",
      "bar chart square minus"
    ]
  },
  {
    "name": "BarChartSquarePlus",
    "label": "Bar Chart Square Plus",
    "category": "Charts",
    "baseFamily": "BarChartSquarePlus",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "BarChartSquarePlus"
    ],
    "tags": [
      "bar",
      "chart",
      "square",
      "plus",
      "barchartsquareplus",
      "bar chart square plus"
    ]
  },
  {
    "name": "BarChartSquareUp",
    "label": "Bar Chart Square Up",
    "category": "Charts",
    "baseFamily": "BarChartSquareUp",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "BarChartSquareUp"
    ],
    "tags": [
      "bar",
      "chart",
      "square",
      "up",
      "barchartsquareup",
      "bar chart square up"
    ]
  },
  {
    "name": "BarLineChart",
    "label": "Bar Line Chart",
    "category": "Charts",
    "baseFamily": "BarLineChart",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "BarLineChart"
    ],
    "tags": [
      "bar",
      "line",
      "chart",
      "barlinechart",
      "bar line chart"
    ]
  },
  {
    "name": "BatteryCharging01",
    "label": "Battery Charging 01",
    "category": "Media & devices",
    "baseFamily": "BatteryCharging",
    "isFirstVariant": true,
    "variantCount": 2,
    "familyVariants": [
      "BatteryCharging01",
      "BatteryCharging02"
    ],
    "tags": [
      "battery",
      "charging",
      "batterycharging01",
      "battery charging 01",
      "batterycharging"
    ]
  },
  {
    "name": "BatteryCharging02",
    "label": "Battery Charging 02",
    "category": "Media & devices",
    "baseFamily": "BatteryCharging",
    "isFirstVariant": false,
    "variantCount": 2,
    "familyVariants": [
      "BatteryCharging01",
      "BatteryCharging02"
    ],
    "tags": [
      "battery",
      "charging",
      "batterycharging02",
      "battery charging 02",
      "batterycharging"
    ]
  },
  {
    "name": "BatteryEmpty",
    "label": "Battery Empty",
    "category": "Media & devices",
    "baseFamily": "BatteryEmpty",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "BatteryEmpty"
    ],
    "tags": [
      "battery",
      "empty",
      "batteryempty",
      "battery empty"
    ]
  },
  {
    "name": "BatteryFull",
    "label": "Battery Full",
    "category": "Media & devices",
    "baseFamily": "BatteryFull",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "BatteryFull"
    ],
    "tags": [
      "battery",
      "full",
      "batteryfull",
      "battery full"
    ]
  },
  {
    "name": "BatteryLow",
    "label": "Battery Low",
    "category": "Media & devices",
    "baseFamily": "BatteryLow",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "BatteryLow"
    ],
    "tags": [
      "battery",
      "low",
      "batterylow",
      "battery low"
    ]
  },
  {
    "name": "BatteryMid",
    "label": "Battery Mid",
    "category": "Media & devices",
    "baseFamily": "BatteryMid",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "BatteryMid"
    ],
    "tags": [
      "battery",
      "mid",
      "batterymid",
      "battery mid"
    ]
  },
  {
    "name": "Beaker01",
    "label": "Beaker 01",
    "category": "Education",
    "baseFamily": "Beaker",
    "isFirstVariant": true,
    "variantCount": 2,
    "familyVariants": [
      "Beaker01",
      "Beaker02"
    ],
    "tags": [
      "beaker",
      "beaker01",
      "beaker 01"
    ]
  },
  {
    "name": "Beaker02",
    "label": "Beaker 02",
    "category": "Education",
    "baseFamily": "Beaker",
    "isFirstVariant": false,
    "variantCount": 2,
    "familyVariants": [
      "Beaker01",
      "Beaker02"
    ],
    "tags": [
      "beaker",
      "beaker02",
      "beaker 02"
    ]
  },
  {
    "name": "Bell01",
    "label": "Bell 01",
    "category": "Communication",
    "baseFamily": "Bell",
    "isFirstVariant": true,
    "variantCount": 4,
    "familyVariants": [
      "Bell01",
      "Bell02",
      "Bell03",
      "Bell04"
    ],
    "tags": [
      "bell",
      "notification",
      "reminder",
      "alert",
      "alarm",
      "notice",
      "bell01",
      "bell 01"
    ]
  },
  {
    "name": "Bell02",
    "label": "Bell 02",
    "category": "Communication",
    "baseFamily": "Bell",
    "isFirstVariant": false,
    "variantCount": 4,
    "familyVariants": [
      "Bell01",
      "Bell02",
      "Bell03",
      "Bell04"
    ],
    "tags": [
      "bell",
      "notification",
      "reminder",
      "alert",
      "alarm",
      "bell02",
      "bell 02"
    ]
  },
  {
    "name": "Bell03",
    "label": "Bell 03",
    "category": "Communication",
    "baseFamily": "Bell",
    "isFirstVariant": false,
    "variantCount": 4,
    "familyVariants": [
      "Bell01",
      "Bell02",
      "Bell03",
      "Bell04"
    ],
    "tags": [
      "bell",
      "bell03",
      "bell 03"
    ]
  },
  {
    "name": "Bell04",
    "label": "Bell 04",
    "category": "Communication",
    "baseFamily": "Bell",
    "isFirstVariant": false,
    "variantCount": 4,
    "familyVariants": [
      "Bell01",
      "Bell02",
      "Bell03",
      "Bell04"
    ],
    "tags": [
      "bell",
      "bell04",
      "bell 04"
    ]
  },
  {
    "name": "BellMinus",
    "label": "Bell Minus",
    "category": "Communication",
    "baseFamily": "BellMinus",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "BellMinus"
    ],
    "tags": [
      "bell",
      "minus",
      "bellminus",
      "bell minus"
    ]
  },
  {
    "name": "BellOff01",
    "label": "Bell Off 01",
    "category": "Communication",
    "baseFamily": "BellOff",
    "isFirstVariant": true,
    "variantCount": 3,
    "familyVariants": [
      "BellOff01",
      "BellOff02",
      "BellOff03"
    ],
    "tags": [
      "bell",
      "off",
      "belloff01",
      "bell off 01",
      "belloff"
    ]
  },
  {
    "name": "BellOff02",
    "label": "Bell Off 02",
    "category": "Communication",
    "baseFamily": "BellOff",
    "isFirstVariant": false,
    "variantCount": 3,
    "familyVariants": [
      "BellOff01",
      "BellOff02",
      "BellOff03"
    ],
    "tags": [
      "bell",
      "off",
      "belloff02",
      "bell off 02",
      "belloff"
    ]
  },
  {
    "name": "BellOff03",
    "label": "Bell Off 03",
    "category": "Communication",
    "baseFamily": "BellOff",
    "isFirstVariant": false,
    "variantCount": 3,
    "familyVariants": [
      "BellOff01",
      "BellOff02",
      "BellOff03"
    ],
    "tags": [
      "bell",
      "off",
      "belloff03",
      "bell off 03",
      "belloff"
    ]
  },
  {
    "name": "BellPlus",
    "label": "Bell Plus",
    "category": "Communication",
    "baseFamily": "BellPlus",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "BellPlus"
    ],
    "tags": [
      "bell",
      "plus",
      "bellplus",
      "bell plus"
    ]
  },
  {
    "name": "BellRinging01",
    "label": "Bell Ringing 01",
    "category": "Communication",
    "baseFamily": "BellRinging",
    "isFirstVariant": true,
    "variantCount": 4,
    "familyVariants": [
      "BellRinging01",
      "BellRinging02",
      "BellRinging03",
      "BellRinging04"
    ],
    "tags": [
      "bell",
      "ringing",
      "bellringing01",
      "bell ringing 01",
      "bellringing"
    ]
  },
  {
    "name": "BellRinging02",
    "label": "Bell Ringing 02",
    "category": "Communication",
    "baseFamily": "BellRinging",
    "isFirstVariant": false,
    "variantCount": 4,
    "familyVariants": [
      "BellRinging01",
      "BellRinging02",
      "BellRinging03",
      "BellRinging04"
    ],
    "tags": [
      "bell",
      "ringing",
      "bellringing02",
      "bell ringing 02",
      "bellringing"
    ]
  },
  {
    "name": "BellRinging03",
    "label": "Bell Ringing 03",
    "category": "Communication",
    "baseFamily": "BellRinging",
    "isFirstVariant": false,
    "variantCount": 4,
    "familyVariants": [
      "BellRinging01",
      "BellRinging02",
      "BellRinging03",
      "BellRinging04"
    ],
    "tags": [
      "bell",
      "ringing",
      "bellringing03",
      "bell ringing 03",
      "bellringing"
    ]
  },
  {
    "name": "BellRinging04",
    "label": "Bell Ringing 04",
    "category": "Communication",
    "baseFamily": "BellRinging",
    "isFirstVariant": false,
    "variantCount": 4,
    "familyVariants": [
      "BellRinging01",
      "BellRinging02",
      "BellRinging03",
      "BellRinging04"
    ],
    "tags": [
      "bell",
      "ringing",
      "bellringing04",
      "bell ringing 04",
      "bellringing"
    ]
  },
  {
    "name": "BezierCurve01",
    "label": "Bezier Curve 01",
    "category": "Editor",
    "baseFamily": "BezierCurve",
    "isFirstVariant": true,
    "variantCount": 3,
    "familyVariants": [
      "BezierCurve01",
      "BezierCurve02",
      "BezierCurve03"
    ],
    "tags": [
      "bezier",
      "curve",
      "beziercurve01",
      "bezier curve 01",
      "beziercurve"
    ]
  },
  {
    "name": "BezierCurve02",
    "label": "Bezier Curve 02",
    "category": "Editor",
    "baseFamily": "BezierCurve",
    "isFirstVariant": false,
    "variantCount": 3,
    "familyVariants": [
      "BezierCurve01",
      "BezierCurve02",
      "BezierCurve03"
    ],
    "tags": [
      "bezier",
      "curve",
      "beziercurve02",
      "bezier curve 02",
      "beziercurve"
    ]
  },
  {
    "name": "BezierCurve03",
    "label": "Bezier Curve 03",
    "category": "Editor",
    "baseFamily": "BezierCurve",
    "isFirstVariant": false,
    "variantCount": 3,
    "familyVariants": [
      "BezierCurve01",
      "BezierCurve02",
      "BezierCurve03"
    ],
    "tags": [
      "bezier",
      "curve",
      "beziercurve03",
      "bezier curve 03",
      "beziercurve"
    ]
  },
  {
    "name": "BluetoothConnect",
    "label": "Bluetooth Connect",
    "category": "Media & devices",
    "baseFamily": "BluetoothConnect",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "BluetoothConnect"
    ],
    "tags": [
      "bluetooth",
      "connect",
      "bluetoothconnect",
      "bluetooth connect"
    ]
  },
  {
    "name": "BluetoothOff",
    "label": "Bluetooth Off",
    "category": "Media & devices",
    "baseFamily": "BluetoothOff",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "BluetoothOff"
    ],
    "tags": [
      "bluetooth",
      "off",
      "bluetoothoff",
      "bluetooth off"
    ]
  },
  {
    "name": "BluetoothOn",
    "label": "Bluetooth On",
    "category": "Media & devices",
    "baseFamily": "BluetoothOn",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "BluetoothOn"
    ],
    "tags": [
      "bluetooth",
      "on",
      "bluetoothon",
      "bluetooth on"
    ]
  },
  {
    "name": "BluetoothSignal",
    "label": "Bluetooth Signal",
    "category": "Media & devices",
    "baseFamily": "BluetoothSignal",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "BluetoothSignal"
    ],
    "tags": [
      "bluetooth",
      "signal",
      "bluetoothsignal",
      "bluetooth signal"
    ]
  },
  {
    "name": "Bold01",
    "label": "Bold 01",
    "category": "Editor",
    "baseFamily": "Bold",
    "isFirstVariant": true,
    "variantCount": 2,
    "familyVariants": [
      "Bold01",
      "Bold02"
    ],
    "tags": [
      "bold",
      "bold01",
      "bold 01"
    ]
  },
  {
    "name": "Bold02",
    "label": "Bold 02",
    "category": "Editor",
    "baseFamily": "Bold",
    "isFirstVariant": false,
    "variantCount": 2,
    "familyVariants": [
      "Bold01",
      "Bold02"
    ],
    "tags": [
      "bold",
      "bold02",
      "bold 02"
    ]
  },
  {
    "name": "BoldSquare",
    "label": "Bold Square",
    "category": "Editor",
    "baseFamily": "BoldSquare",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "BoldSquare"
    ],
    "tags": [
      "bold",
      "square",
      "boldsquare",
      "bold square"
    ]
  },
  {
    "name": "BookClosed",
    "label": "Book Closed",
    "category": "Files",
    "baseFamily": "BookClosed",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "BookClosed"
    ],
    "tags": [
      "book",
      "closed",
      "bookclosed",
      "book closed"
    ]
  },
  {
    "name": "BookOpen01",
    "label": "Book Open 01",
    "category": "Files",
    "baseFamily": "BookOpen",
    "isFirstVariant": true,
    "variantCount": 2,
    "familyVariants": [
      "BookOpen01",
      "BookOpen02"
    ],
    "tags": [
      "book",
      "open",
      "learning",
      "course",
      "reading",
      "books",
      "literature",
      "manual",
      "study",
      "education",
      "bookopen01",
      "book open 01",
      "bookopen"
    ]
  },
  {
    "name": "BookOpen02",
    "label": "Book Open 02",
    "category": "Files",
    "baseFamily": "BookOpen",
    "isFirstVariant": false,
    "variantCount": 2,
    "familyVariants": [
      "BookOpen01",
      "BookOpen02"
    ],
    "tags": [
      "book",
      "open",
      "learning",
      "course",
      "reading",
      "books",
      "literature",
      "manual",
      "bookopen02",
      "book open 02",
      "bookopen"
    ]
  },
  {
    "name": "Bookmark",
    "label": "Bookmark",
    "category": "Files",
    "baseFamily": "Bookmark",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "Bookmark"
    ],
    "tags": [
      "bookmark"
    ]
  },
  {
    "name": "BookmarkAdd",
    "label": "Bookmark Add",
    "category": "Files",
    "baseFamily": "BookmarkAdd",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "BookmarkAdd"
    ],
    "tags": [
      "bookmark",
      "add",
      "bookmarkadd",
      "bookmark add"
    ]
  },
  {
    "name": "BookmarkCheck",
    "label": "Bookmark Check",
    "category": "Files",
    "baseFamily": "BookmarkCheck",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "BookmarkCheck"
    ],
    "tags": [
      "bookmark",
      "check",
      "bookmarkcheck",
      "bookmark check"
    ]
  },
  {
    "name": "BookmarkMinus",
    "label": "Bookmark Minus",
    "category": "Files",
    "baseFamily": "BookmarkMinus",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "BookmarkMinus"
    ],
    "tags": [
      "bookmark",
      "minus",
      "bookmarkminus",
      "bookmark minus"
    ]
  },
  {
    "name": "BookmarkX",
    "label": "Bookmark X",
    "category": "Files",
    "baseFamily": "BookmarkX",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "BookmarkX"
    ],
    "tags": [
      "bookmark",
      "x",
      "bookmarkx",
      "bookmark x"
    ]
  },
  {
    "name": "Box",
    "label": "Box",
    "category": "Files",
    "baseFamily": "Box",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "Box"
    ],
    "tags": [
      "box"
    ]
  },
  {
    "name": "Brackets",
    "label": "Brackets",
    "category": "Development",
    "baseFamily": "Brackets",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "Brackets"
    ],
    "tags": [
      "brackets"
    ]
  },
  {
    "name": "BracketsCheck",
    "label": "Brackets Check",
    "category": "Development",
    "baseFamily": "BracketsCheck",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "BracketsCheck"
    ],
    "tags": [
      "brackets",
      "check",
      "bracketscheck",
      "brackets check"
    ]
  },
  {
    "name": "BracketsEllipses",
    "label": "Brackets Ellipses",
    "category": "Development",
    "baseFamily": "BracketsEllipses",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "BracketsEllipses"
    ],
    "tags": [
      "brackets",
      "ellipses",
      "bracketsellipses",
      "brackets ellipses"
    ]
  },
  {
    "name": "BracketsMinus",
    "label": "Brackets Minus",
    "category": "Development",
    "baseFamily": "BracketsMinus",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "BracketsMinus"
    ],
    "tags": [
      "brackets",
      "minus",
      "bracketsminus",
      "brackets minus"
    ]
  },
  {
    "name": "BracketsPlus",
    "label": "Brackets Plus",
    "category": "Development",
    "baseFamily": "BracketsPlus",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "BracketsPlus"
    ],
    "tags": [
      "brackets",
      "plus",
      "bracketsplus",
      "brackets plus"
    ]
  },
  {
    "name": "BracketsSlash",
    "label": "Brackets Slash",
    "category": "Development",
    "baseFamily": "BracketsSlash",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "BracketsSlash"
    ],
    "tags": [
      "brackets",
      "slash",
      "bracketsslash",
      "brackets slash"
    ]
  },
  {
    "name": "BracketsX",
    "label": "Brackets X",
    "category": "Development",
    "baseFamily": "BracketsX",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "BracketsX"
    ],
    "tags": [
      "brackets",
      "x",
      "bracketsx",
      "brackets x"
    ]
  },
  {
    "name": "Briefcase01",
    "label": "Briefcase 01",
    "category": "General",
    "baseFamily": "Briefcase",
    "isFirstVariant": true,
    "variantCount": 2,
    "familyVariants": [
      "Briefcase01",
      "Briefcase02"
    ],
    "tags": [
      "briefcase",
      "briefcase01",
      "briefcase 01"
    ]
  },
  {
    "name": "Briefcase02",
    "label": "Briefcase 02",
    "category": "General",
    "baseFamily": "Briefcase",
    "isFirstVariant": false,
    "variantCount": 2,
    "familyVariants": [
      "Briefcase01",
      "Briefcase02"
    ],
    "tags": [
      "briefcase",
      "briefcase02",
      "briefcase 02"
    ]
  },
  {
    "name": "Browser",
    "label": "Browser",
    "category": "General",
    "baseFamily": "Browser",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "Browser"
    ],
    "tags": [
      "browser"
    ]
  },
  {
    "name": "Brush01",
    "label": "Brush 01",
    "category": "Images",
    "baseFamily": "Brush",
    "isFirstVariant": true,
    "variantCount": 3,
    "familyVariants": [
      "Brush01",
      "Brush02",
      "Brush03"
    ],
    "tags": [
      "brush",
      "brush01",
      "brush 01"
    ]
  },
  {
    "name": "Brush02",
    "label": "Brush 02",
    "category": "Images",
    "baseFamily": "Brush",
    "isFirstVariant": false,
    "variantCount": 3,
    "familyVariants": [
      "Brush01",
      "Brush02",
      "Brush03"
    ],
    "tags": [
      "brush",
      "brush02",
      "brush 02"
    ]
  },
  {
    "name": "Brush03",
    "label": "Brush 03",
    "category": "Images",
    "baseFamily": "Brush",
    "isFirstVariant": false,
    "variantCount": 3,
    "familyVariants": [
      "Brush01",
      "Brush02",
      "Brush03"
    ],
    "tags": [
      "brush",
      "brush03",
      "brush 03"
    ]
  },
  {
    "name": "Building01",
    "label": "Building 01",
    "category": "Maps & travel",
    "baseFamily": "Building",
    "isFirstVariant": true,
    "variantCount": 8,
    "familyVariants": [
      "Building01",
      "Building02",
      "Building03",
      "Building04",
      "Building05",
      "Building06",
      "Building07",
      "Building08"
    ],
    "tags": [
      "building",
      "company",
      "enterprise",
      "property",
      "real estate",
      "office",
      "corporation",
      "estate",
      "work",
      "building01",
      "building 01"
    ]
  },
  {
    "name": "Building02",
    "label": "Building 02",
    "category": "Maps & travel",
    "baseFamily": "Building",
    "isFirstVariant": false,
    "variantCount": 8,
    "familyVariants": [
      "Building01",
      "Building02",
      "Building03",
      "Building04",
      "Building05",
      "Building06",
      "Building07",
      "Building08"
    ],
    "tags": [
      "building",
      "company",
      "enterprise",
      "property",
      "real estate",
      "office",
      "corporation",
      "building02",
      "building 02"
    ]
  },
  {
    "name": "Building03",
    "label": "Building 03",
    "category": "Maps & travel",
    "baseFamily": "Building",
    "isFirstVariant": false,
    "variantCount": 8,
    "familyVariants": [
      "Building01",
      "Building02",
      "Building03",
      "Building04",
      "Building05",
      "Building06",
      "Building07",
      "Building08"
    ],
    "tags": [
      "building",
      "company",
      "enterprise",
      "property",
      "real estate",
      "office",
      "corporation",
      "building03",
      "building 03"
    ]
  },
  {
    "name": "Building04",
    "label": "Building 04",
    "category": "Maps & travel",
    "baseFamily": "Building",
    "isFirstVariant": false,
    "variantCount": 8,
    "familyVariants": [
      "Building01",
      "Building02",
      "Building03",
      "Building04",
      "Building05",
      "Building06",
      "Building07",
      "Building08"
    ],
    "tags": [
      "building",
      "skyscraper",
      "property",
      "real estate",
      "hotel",
      "headquarters",
      "building04",
      "building 04"
    ]
  },
  {
    "name": "Building05",
    "label": "Building 05",
    "category": "Maps & travel",
    "baseFamily": "Building",
    "isFirstVariant": false,
    "variantCount": 8,
    "familyVariants": [
      "Building01",
      "Building02",
      "Building03",
      "Building04",
      "Building05",
      "Building06",
      "Building07",
      "Building08"
    ],
    "tags": [
      "building",
      "store",
      "property",
      "facility",
      "building05",
      "building 05"
    ]
  },
  {
    "name": "Building06",
    "label": "Building 06",
    "category": "Maps & travel",
    "baseFamily": "Building",
    "isFirstVariant": false,
    "variantCount": 8,
    "familyVariants": [
      "Building01",
      "Building02",
      "Building03",
      "Building04",
      "Building05",
      "Building06",
      "Building07",
      "Building08"
    ],
    "tags": [
      "building",
      "architecture",
      "property",
      "real estate",
      "building06",
      "building 06"
    ]
  },
  {
    "name": "Building07",
    "label": "Building 07",
    "category": "Maps & travel",
    "baseFamily": "Building",
    "isFirstVariant": false,
    "variantCount": 8,
    "familyVariants": [
      "Building01",
      "Building02",
      "Building03",
      "Building04",
      "Building05",
      "Building06",
      "Building07",
      "Building08"
    ],
    "tags": [
      "building",
      "office block",
      "property",
      "real estate",
      "building07",
      "building 07"
    ]
  },
  {
    "name": "Building08",
    "label": "Building 08",
    "category": "Maps & travel",
    "baseFamily": "Building",
    "isFirstVariant": false,
    "variantCount": 8,
    "familyVariants": [
      "Building01",
      "Building02",
      "Building03",
      "Building04",
      "Building05",
      "Building06",
      "Building07",
      "Building08"
    ],
    "tags": [
      "building",
      "tower",
      "real estate",
      "property",
      "building08",
      "building 08"
    ]
  },
  {
    "name": "Bus",
    "label": "Bus",
    "category": "Maps & travel",
    "baseFamily": "Bus",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "Bus"
    ],
    "tags": [
      "bus"
    ]
  },
  {
    "name": "Calculator",
    "label": "Calculator",
    "category": "Finance & eCommerce",
    "baseFamily": "Calculator",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "Calculator"
    ],
    "tags": [
      "calculator",
      "math",
      "finance",
      "calculate",
      "accounting",
      "budget",
      "tax"
    ]
  },
  {
    "name": "Calendar",
    "label": "Calendar",
    "category": "Time",
    "baseFamily": "Calendar",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "Calendar"
    ],
    "tags": [
      "calendar",
      "date",
      "month",
      "schedule",
      "events",
      "appointment",
      "year",
      "planning"
    ]
  },
  {
    "name": "CalendarCheck01",
    "label": "Calendar Check 01",
    "category": "Time",
    "baseFamily": "CalendarCheck",
    "isFirstVariant": true,
    "variantCount": 2,
    "familyVariants": [
      "CalendarCheck01",
      "CalendarCheck02"
    ],
    "tags": [
      "calendar",
      "check",
      "scheduled",
      "appointment confirmed",
      "due date",
      "payday",
      "calendarcheck01",
      "calendar check 01",
      "calendarcheck"
    ]
  },
  {
    "name": "CalendarCheck02",
    "label": "Calendar Check 02",
    "category": "Time",
    "baseFamily": "CalendarCheck",
    "isFirstVariant": false,
    "variantCount": 2,
    "familyVariants": [
      "CalendarCheck01",
      "CalendarCheck02"
    ],
    "tags": [
      "calendar",
      "check",
      "calendarcheck02",
      "calendar check 02",
      "calendarcheck"
    ]
  },
  {
    "name": "CalendarDate",
    "label": "Calendar Date",
    "category": "Time",
    "baseFamily": "CalendarDate",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "CalendarDate"
    ],
    "tags": [
      "calendar",
      "date",
      "calendardate",
      "calendar date"
    ]
  },
  {
    "name": "CalendarHeart01",
    "label": "Calendar Heart 01",
    "category": "Time",
    "baseFamily": "CalendarHeart",
    "isFirstVariant": true,
    "variantCount": 2,
    "familyVariants": [
      "CalendarHeart01",
      "CalendarHeart02"
    ],
    "tags": [
      "calendar",
      "heart",
      "calendarheart01",
      "calendar heart 01",
      "calendarheart"
    ]
  },
  {
    "name": "CalendarHeart02",
    "label": "Calendar Heart 02",
    "category": "Time",
    "baseFamily": "CalendarHeart",
    "isFirstVariant": false,
    "variantCount": 2,
    "familyVariants": [
      "CalendarHeart01",
      "CalendarHeart02"
    ],
    "tags": [
      "calendar",
      "heart",
      "calendarheart02",
      "calendar heart 02",
      "calendarheart"
    ]
  },
  {
    "name": "CalendarMinus01",
    "label": "Calendar Minus 01",
    "category": "Time",
    "baseFamily": "CalendarMinus",
    "isFirstVariant": true,
    "variantCount": 2,
    "familyVariants": [
      "CalendarMinus01",
      "CalendarMinus02"
    ],
    "tags": [
      "calendar",
      "minus",
      "calendarminus01",
      "calendar minus 01",
      "calendarminus"
    ]
  },
  {
    "name": "CalendarMinus02",
    "label": "Calendar Minus 02",
    "category": "Time",
    "baseFamily": "CalendarMinus",
    "isFirstVariant": false,
    "variantCount": 2,
    "familyVariants": [
      "CalendarMinus01",
      "CalendarMinus02"
    ],
    "tags": [
      "calendar",
      "minus",
      "calendarminus02",
      "calendar minus 02",
      "calendarminus"
    ]
  },
  {
    "name": "CalendarPlus01",
    "label": "Calendar Plus 01",
    "category": "Time",
    "baseFamily": "CalendarPlus",
    "isFirstVariant": true,
    "variantCount": 2,
    "familyVariants": [
      "CalendarPlus01",
      "CalendarPlus02"
    ],
    "tags": [
      "calendar",
      "plus",
      "add event",
      "new schedule",
      "booking",
      "calendarplus01",
      "calendar plus 01",
      "calendarplus"
    ]
  },
  {
    "name": "CalendarPlus02",
    "label": "Calendar Plus 02",
    "category": "Time",
    "baseFamily": "CalendarPlus",
    "isFirstVariant": false,
    "variantCount": 2,
    "familyVariants": [
      "CalendarPlus01",
      "CalendarPlus02"
    ],
    "tags": [
      "calendar",
      "plus",
      "calendarplus02",
      "calendar plus 02",
      "calendarplus"
    ]
  },
  {
    "name": "Camera01",
    "label": "Camera 01",
    "category": "Media & devices",
    "baseFamily": "Camera",
    "isFirstVariant": true,
    "variantCount": 3,
    "familyVariants": [
      "Camera01",
      "Camera02",
      "Camera03"
    ],
    "tags": [
      "camera",
      "camera01",
      "camera 01"
    ]
  },
  {
    "name": "Camera02",
    "label": "Camera 02",
    "category": "Media & devices",
    "baseFamily": "Camera",
    "isFirstVariant": false,
    "variantCount": 3,
    "familyVariants": [
      "Camera01",
      "Camera02",
      "Camera03"
    ],
    "tags": [
      "camera",
      "camera02",
      "camera 02"
    ]
  },
  {
    "name": "Camera03",
    "label": "Camera 03",
    "category": "Media & devices",
    "baseFamily": "Camera",
    "isFirstVariant": false,
    "variantCount": 3,
    "familyVariants": [
      "Camera01",
      "Camera02",
      "Camera03"
    ],
    "tags": [
      "camera",
      "camera03",
      "camera 03"
    ]
  },
  {
    "name": "CameraLens",
    "label": "Camera Lens",
    "category": "Media & devices",
    "baseFamily": "CameraLens",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "CameraLens"
    ],
    "tags": [
      "camera",
      "lens",
      "cameralens",
      "camera lens"
    ]
  },
  {
    "name": "CameraOff",
    "label": "Camera Off",
    "category": "Media & devices",
    "baseFamily": "CameraOff",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "CameraOff"
    ],
    "tags": [
      "camera",
      "off",
      "cameraoff",
      "camera off"
    ]
  },
  {
    "name": "CameraPlus",
    "label": "Camera Plus",
    "category": "Media & devices",
    "baseFamily": "CameraPlus",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "CameraPlus"
    ],
    "tags": [
      "camera",
      "plus",
      "cameraplus",
      "camera plus"
    ]
  },
  {
    "name": "Car01",
    "label": "Car 01",
    "category": "Maps & travel",
    "baseFamily": "Car",
    "isFirstVariant": true,
    "variantCount": 2,
    "familyVariants": [
      "Car01",
      "Car02"
    ],
    "tags": [
      "car",
      "car01",
      "car 01"
    ]
  },
  {
    "name": "Car02",
    "label": "Car 02",
    "category": "Maps & travel",
    "baseFamily": "Car",
    "isFirstVariant": false,
    "variantCount": 2,
    "familyVariants": [
      "Car01",
      "Car02"
    ],
    "tags": [
      "car",
      "car02",
      "car 02"
    ]
  },
  {
    "name": "Certificate01",
    "label": "Certificate 01",
    "category": "Files",
    "baseFamily": "Certificate",
    "isFirstVariant": true,
    "variantCount": 2,
    "familyVariants": [
      "Certificate01",
      "Certificate02"
    ],
    "tags": [
      "certificate",
      "certificate01",
      "certificate 01"
    ]
  },
  {
    "name": "Certificate02",
    "label": "Certificate 02",
    "category": "Files",
    "baseFamily": "Certificate",
    "isFirstVariant": false,
    "variantCount": 2,
    "familyVariants": [
      "Certificate01",
      "Certificate02"
    ],
    "tags": [
      "certificate",
      "certificate02",
      "certificate 02"
    ]
  },
  {
    "name": "ChartBreakoutCircle",
    "label": "Chart Breakout Circle",
    "category": "Charts",
    "baseFamily": "ChartBreakoutCircle",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "ChartBreakoutCircle"
    ],
    "tags": [
      "chart",
      "breakout",
      "circle",
      "chartbreakoutcircle",
      "chart breakout circle"
    ]
  },
  {
    "name": "ChartBreakoutSquare",
    "label": "Chart Breakout Square",
    "category": "Charts",
    "baseFamily": "ChartBreakoutSquare",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "ChartBreakoutSquare"
    ],
    "tags": [
      "chart",
      "breakout",
      "square",
      "chartbreakoutsquare",
      "chart breakout square"
    ]
  },
  {
    "name": "Check",
    "label": "Check",
    "category": "Alerts & feedback",
    "baseFamily": "Check",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "Check"
    ],
    "tags": [
      "check"
    ]
  },
  {
    "name": "CheckCircle",
    "label": "Check Circle",
    "category": "Alerts & feedback",
    "baseFamily": "CheckCircle",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "CheckCircle"
    ],
    "tags": [
      "check",
      "circle",
      "checkcircle",
      "check circle"
    ]
  },
  {
    "name": "CheckCircleBroken",
    "label": "Check Circle Broken",
    "category": "Alerts & feedback",
    "baseFamily": "CheckCircleBroken",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "CheckCircleBroken"
    ],
    "tags": [
      "check",
      "circle",
      "broken",
      "checkcirclebroken",
      "check circle broken"
    ]
  },
  {
    "name": "CheckDone01",
    "label": "Check Done 01",
    "category": "Alerts & feedback",
    "baseFamily": "CheckDone",
    "isFirstVariant": true,
    "variantCount": 2,
    "familyVariants": [
      "CheckDone01",
      "CheckDone02"
    ],
    "tags": [
      "check",
      "done",
      "checkdone01",
      "check done 01",
      "checkdone"
    ]
  },
  {
    "name": "CheckDone02",
    "label": "Check Done 02",
    "category": "Alerts & feedback",
    "baseFamily": "CheckDone",
    "isFirstVariant": false,
    "variantCount": 2,
    "familyVariants": [
      "CheckDone01",
      "CheckDone02"
    ],
    "tags": [
      "check",
      "done",
      "checkdone02",
      "check done 02",
      "checkdone"
    ]
  },
  {
    "name": "CheckHeart",
    "label": "Check Heart",
    "category": "Alerts & feedback",
    "baseFamily": "CheckHeart",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "CheckHeart"
    ],
    "tags": [
      "check",
      "heart",
      "checkheart",
      "check heart"
    ]
  },
  {
    "name": "CheckSquare",
    "label": "Check Square",
    "category": "Alerts & feedback",
    "baseFamily": "CheckSquare",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "CheckSquare"
    ],
    "tags": [
      "check",
      "square",
      "checksquare",
      "check square"
    ]
  },
  {
    "name": "CheckSquareBroken",
    "label": "Check Square Broken",
    "category": "Alerts & feedback",
    "baseFamily": "CheckSquareBroken",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "CheckSquareBroken"
    ],
    "tags": [
      "check",
      "square",
      "broken",
      "checksquarebroken",
      "check square broken"
    ]
  },
  {
    "name": "CheckVerified01",
    "label": "Check Verified 01",
    "category": "Alerts & feedback",
    "baseFamily": "CheckVerified",
    "isFirstVariant": true,
    "variantCount": 3,
    "familyVariants": [
      "CheckVerified01",
      "CheckVerified02",
      "CheckVerified03"
    ],
    "tags": [
      "check",
      "verified",
      "checkverified01",
      "check verified 01",
      "checkverified"
    ]
  },
  {
    "name": "CheckVerified02",
    "label": "Check Verified 02",
    "category": "Alerts & feedback",
    "baseFamily": "CheckVerified",
    "isFirstVariant": false,
    "variantCount": 3,
    "familyVariants": [
      "CheckVerified01",
      "CheckVerified02",
      "CheckVerified03"
    ],
    "tags": [
      "check",
      "verified",
      "checkverified02",
      "check verified 02",
      "checkverified"
    ]
  },
  {
    "name": "CheckVerified03",
    "label": "Check Verified 03",
    "category": "Alerts & feedback",
    "baseFamily": "CheckVerified",
    "isFirstVariant": false,
    "variantCount": 3,
    "familyVariants": [
      "CheckVerified01",
      "CheckVerified02",
      "CheckVerified03"
    ],
    "tags": [
      "check",
      "verified",
      "checkverified03",
      "check verified 03",
      "checkverified"
    ]
  },
  {
    "name": "ChevronDown",
    "label": "Chevron Down",
    "category": "Arrows",
    "baseFamily": "ChevronDown",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "ChevronDown"
    ],
    "tags": [
      "chevron",
      "down",
      "chevrondown",
      "chevron down"
    ]
  },
  {
    "name": "ChevronDownDouble",
    "label": "Chevron Down Double",
    "category": "Arrows",
    "baseFamily": "ChevronDownDouble",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "ChevronDownDouble"
    ],
    "tags": [
      "chevron",
      "down",
      "double",
      "chevrondowndouble",
      "chevron down double"
    ]
  },
  {
    "name": "ChevronLeft",
    "label": "Chevron Left",
    "category": "Arrows",
    "baseFamily": "ChevronLeft",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "ChevronLeft"
    ],
    "tags": [
      "chevron",
      "left",
      "chevronleft",
      "chevron left"
    ]
  },
  {
    "name": "ChevronLeftDouble",
    "label": "Chevron Left Double",
    "category": "Arrows",
    "baseFamily": "ChevronLeftDouble",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "ChevronLeftDouble"
    ],
    "tags": [
      "chevron",
      "left",
      "double",
      "chevronleftdouble",
      "chevron left double"
    ]
  },
  {
    "name": "ChevronNext",
    "label": "Chevron Next",
    "category": "Arrows",
    "baseFamily": "ChevronNext",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "ChevronNext"
    ],
    "tags": [
      "chevron",
      "next",
      "chevronnext",
      "chevron next"
    ]
  },
  {
    "name": "ChevronNextDouble",
    "label": "Chevron Next Double",
    "category": "Arrows",
    "baseFamily": "ChevronNextDouble",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "ChevronNextDouble"
    ],
    "tags": [
      "chevron",
      "next",
      "double",
      "chevronnextdouble",
      "chevron next double"
    ]
  },
  {
    "name": "ChevronPrevious",
    "label": "Chevron Previous",
    "category": "Arrows",
    "baseFamily": "ChevronPrevious",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "ChevronPrevious"
    ],
    "tags": [
      "chevron",
      "previous",
      "chevronprevious",
      "chevron previous"
    ]
  },
  {
    "name": "ChevronPreviousDouble",
    "label": "Chevron Previous Double",
    "category": "Arrows",
    "baseFamily": "ChevronPreviousDouble",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "ChevronPreviousDouble"
    ],
    "tags": [
      "chevron",
      "previous",
      "double",
      "chevronpreviousdouble",
      "chevron previous double"
    ]
  },
  {
    "name": "ChevronRight",
    "label": "Chevron Right",
    "category": "Arrows",
    "baseFamily": "ChevronRight",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "ChevronRight"
    ],
    "tags": [
      "chevron",
      "right",
      "chevronright",
      "chevron right"
    ]
  },
  {
    "name": "ChevronRightDouble",
    "label": "Chevron Right Double",
    "category": "Arrows",
    "baseFamily": "ChevronRightDouble",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "ChevronRightDouble"
    ],
    "tags": [
      "chevron",
      "right",
      "double",
      "chevronrightdouble",
      "chevron right double"
    ]
  },
  {
    "name": "ChevronSelectorHorizontal",
    "label": "Chevron Selector Horizontal",
    "category": "Arrows",
    "baseFamily": "ChevronSelectorHorizontal",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "ChevronSelectorHorizontal"
    ],
    "tags": [
      "chevron",
      "selector",
      "horizontal",
      "chevronselectorhorizontal",
      "chevron selector horizontal"
    ]
  },
  {
    "name": "ChevronSelectorVertical",
    "label": "Chevron Selector Vertical",
    "category": "Arrows",
    "baseFamily": "ChevronSelectorVertical",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "ChevronSelectorVertical"
    ],
    "tags": [
      "chevron",
      "selector",
      "vertical",
      "chevronselectorvertical",
      "chevron selector vertical"
    ]
  },
  {
    "name": "ChevronUp",
    "label": "Chevron Up",
    "category": "Arrows",
    "baseFamily": "ChevronUp",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "ChevronUp"
    ],
    "tags": [
      "chevron",
      "up",
      "chevronup",
      "chevron up"
    ]
  },
  {
    "name": "ChevronUpDouble",
    "label": "Chevron Up Double",
    "category": "Arrows",
    "baseFamily": "ChevronUpDouble",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "ChevronUpDouble"
    ],
    "tags": [
      "chevron",
      "up",
      "double",
      "chevronupdouble",
      "chevron up double"
    ]
  },
  {
    "name": "ChromeCast",
    "label": "Chrome Cast",
    "category": "Media & devices",
    "baseFamily": "ChromeCast",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "ChromeCast"
    ],
    "tags": [
      "chrome",
      "cast",
      "chromecast",
      "chrome cast"
    ]
  },
  {
    "name": "Circle",
    "label": "Circle",
    "category": "Shapes",
    "baseFamily": "Circle",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "Circle"
    ],
    "tags": [
      "circle"
    ]
  },
  {
    "name": "CircleCut",
    "label": "Circle Cut",
    "category": "Shapes",
    "baseFamily": "CircleCut",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "CircleCut"
    ],
    "tags": [
      "circle",
      "cut",
      "circlecut",
      "circle cut"
    ]
  },
  {
    "name": "Clapperboard",
    "label": "Clapperboard",
    "category": "Media & devices",
    "baseFamily": "Clapperboard",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "Clapperboard"
    ],
    "tags": [
      "clapperboard"
    ]
  },
  {
    "name": "Clipboard",
    "label": "Clipboard",
    "category": "Files",
    "baseFamily": "Clipboard",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "Clipboard"
    ],
    "tags": [
      "clipboard"
    ]
  },
  {
    "name": "ClipboardAttachment",
    "label": "Clipboard Attachment",
    "category": "Files",
    "baseFamily": "ClipboardAttachment",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "ClipboardAttachment"
    ],
    "tags": [
      "clipboard",
      "attachment",
      "clipboardattachment",
      "clipboard attachment"
    ]
  },
  {
    "name": "ClipboardCheck",
    "label": "Clipboard Check",
    "category": "Files",
    "baseFamily": "ClipboardCheck",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "ClipboardCheck"
    ],
    "tags": [
      "clipboard",
      "check",
      "clipboardcheck",
      "clipboard check"
    ]
  },
  {
    "name": "ClipboardDownload",
    "label": "Clipboard Download",
    "category": "Files",
    "baseFamily": "ClipboardDownload",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "ClipboardDownload"
    ],
    "tags": [
      "clipboard",
      "download",
      "clipboarddownload",
      "clipboard download"
    ]
  },
  {
    "name": "ClipboardMinus",
    "label": "Clipboard Minus",
    "category": "Files",
    "baseFamily": "ClipboardMinus",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "ClipboardMinus"
    ],
    "tags": [
      "clipboard",
      "minus",
      "clipboardminus",
      "clipboard minus"
    ]
  },
  {
    "name": "ClipboardPlus",
    "label": "Clipboard Plus",
    "category": "Files",
    "baseFamily": "ClipboardPlus",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "ClipboardPlus"
    ],
    "tags": [
      "clipboard",
      "plus",
      "clipboardplus",
      "clipboard plus"
    ]
  },
  {
    "name": "ClipboardX",
    "label": "Clipboard X",
    "category": "Files",
    "baseFamily": "ClipboardX",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "ClipboardX"
    ],
    "tags": [
      "clipboard",
      "x",
      "clipboardx",
      "clipboard x"
    ]
  },
  {
    "name": "Clock",
    "label": "Clock",
    "category": "Time",
    "baseFamily": "Clock",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "Clock"
    ],
    "tags": [
      "clock",
      "time",
      "schedule",
      "hour",
      "duration",
      "recurring",
      "watch"
    ]
  },
  {
    "name": "ClockCheck",
    "label": "Clock Check",
    "category": "Time",
    "baseFamily": "ClockCheck",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "ClockCheck"
    ],
    "tags": [
      "clock",
      "check",
      "clockcheck",
      "clock check"
    ]
  },
  {
    "name": "ClockFastForward",
    "label": "Clock Fast Forward",
    "category": "Time",
    "baseFamily": "ClockFastForward",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "ClockFastForward"
    ],
    "tags": [
      "clock",
      "fast",
      "forward",
      "clockfastforward",
      "clock fast forward"
    ]
  },
  {
    "name": "ClockPlus",
    "label": "Clock Plus",
    "category": "Time",
    "baseFamily": "ClockPlus",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "ClockPlus"
    ],
    "tags": [
      "clock",
      "plus",
      "clockplus",
      "clock plus"
    ]
  },
  {
    "name": "ClockRefresh",
    "label": "Clock Refresh",
    "category": "Time",
    "baseFamily": "ClockRefresh",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "ClockRefresh"
    ],
    "tags": [
      "clock",
      "refresh",
      "clockrefresh",
      "clock refresh"
    ]
  },
  {
    "name": "ClockRewind",
    "label": "Clock Rewind",
    "category": "Time",
    "baseFamily": "ClockRewind",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "ClockRewind"
    ],
    "tags": [
      "clock",
      "rewind",
      "clockrewind",
      "clock rewind"
    ]
  },
  {
    "name": "ClockSnooze",
    "label": "Clock Snooze",
    "category": "Time",
    "baseFamily": "ClockSnooze",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "ClockSnooze"
    ],
    "tags": [
      "clock",
      "snooze",
      "clocksnooze",
      "clock snooze"
    ]
  },
  {
    "name": "ClockStopwatch",
    "label": "Clock Stopwatch",
    "category": "Time",
    "baseFamily": "ClockStopwatch",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "ClockStopwatch"
    ],
    "tags": [
      "clock",
      "stopwatch",
      "clockstopwatch",
      "clock stopwatch"
    ]
  },
  {
    "name": "Cloud01",
    "label": "Cloud 01",
    "category": "Weather",
    "baseFamily": "Cloud",
    "isFirstVariant": true,
    "variantCount": 3,
    "familyVariants": [
      "Cloud01",
      "Cloud02",
      "Cloud03"
    ],
    "tags": [
      "cloud",
      "cloud01",
      "cloud 01"
    ]
  },
  {
    "name": "Cloud02",
    "label": "Cloud 02",
    "category": "Weather",
    "baseFamily": "Cloud",
    "isFirstVariant": false,
    "variantCount": 3,
    "familyVariants": [
      "Cloud01",
      "Cloud02",
      "Cloud03"
    ],
    "tags": [
      "cloud",
      "cloud02",
      "cloud 02"
    ]
  },
  {
    "name": "Cloud03",
    "label": "Cloud 03",
    "category": "Weather",
    "baseFamily": "Cloud",
    "isFirstVariant": false,
    "variantCount": 3,
    "familyVariants": [
      "Cloud01",
      "Cloud02",
      "Cloud03"
    ],
    "tags": [
      "cloud",
      "cloud03",
      "cloud 03"
    ]
  },
  {
    "name": "CloudBlank01",
    "label": "Cloud Blank 01",
    "category": "Weather",
    "baseFamily": "CloudBlank",
    "isFirstVariant": true,
    "variantCount": 2,
    "familyVariants": [
      "CloudBlank01",
      "CloudBlank02"
    ],
    "tags": [
      "cloud",
      "blank",
      "cloudblank01",
      "cloud blank 01",
      "cloudblank"
    ]
  },
  {
    "name": "CloudBlank02",
    "label": "Cloud Blank 02",
    "category": "Weather",
    "baseFamily": "CloudBlank",
    "isFirstVariant": false,
    "variantCount": 2,
    "familyVariants": [
      "CloudBlank01",
      "CloudBlank02"
    ],
    "tags": [
      "cloud",
      "blank",
      "cloudblank02",
      "cloud blank 02",
      "cloudblank"
    ]
  },
  {
    "name": "CloudLightning",
    "label": "Cloud Lightning",
    "category": "Weather",
    "baseFamily": "CloudLightning",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "CloudLightning"
    ],
    "tags": [
      "cloud",
      "lightning",
      "cloudlightning",
      "cloud lightning"
    ]
  },
  {
    "name": "CloudMoon",
    "label": "Cloud Moon",
    "category": "Weather",
    "baseFamily": "CloudMoon",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "CloudMoon"
    ],
    "tags": [
      "cloud",
      "moon",
      "cloudmoon",
      "cloud moon"
    ]
  },
  {
    "name": "CloudOff",
    "label": "Cloud Off",
    "category": "Weather",
    "baseFamily": "CloudOff",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "CloudOff"
    ],
    "tags": [
      "cloud",
      "off",
      "cloudoff",
      "cloud off"
    ]
  },
  {
    "name": "CloudRaining01",
    "label": "Cloud Raining 01",
    "category": "Weather",
    "baseFamily": "CloudRaining",
    "isFirstVariant": true,
    "variantCount": 6,
    "familyVariants": [
      "CloudRaining01",
      "CloudRaining02",
      "CloudRaining03",
      "CloudRaining04",
      "CloudRaining05",
      "CloudRaining06"
    ],
    "tags": [
      "cloud",
      "raining",
      "cloudraining01",
      "cloud raining 01",
      "cloudraining"
    ]
  },
  {
    "name": "CloudRaining02",
    "label": "Cloud Raining 02",
    "category": "Weather",
    "baseFamily": "CloudRaining",
    "isFirstVariant": false,
    "variantCount": 6,
    "familyVariants": [
      "CloudRaining01",
      "CloudRaining02",
      "CloudRaining03",
      "CloudRaining04",
      "CloudRaining05",
      "CloudRaining06"
    ],
    "tags": [
      "cloud",
      "raining",
      "cloudraining02",
      "cloud raining 02",
      "cloudraining"
    ]
  },
  {
    "name": "CloudRaining03",
    "label": "Cloud Raining 03",
    "category": "Weather",
    "baseFamily": "CloudRaining",
    "isFirstVariant": false,
    "variantCount": 6,
    "familyVariants": [
      "CloudRaining01",
      "CloudRaining02",
      "CloudRaining03",
      "CloudRaining04",
      "CloudRaining05",
      "CloudRaining06"
    ],
    "tags": [
      "cloud",
      "raining",
      "cloudraining03",
      "cloud raining 03",
      "cloudraining"
    ]
  },
  {
    "name": "CloudRaining04",
    "label": "Cloud Raining 04",
    "category": "Weather",
    "baseFamily": "CloudRaining",
    "isFirstVariant": false,
    "variantCount": 6,
    "familyVariants": [
      "CloudRaining01",
      "CloudRaining02",
      "CloudRaining03",
      "CloudRaining04",
      "CloudRaining05",
      "CloudRaining06"
    ],
    "tags": [
      "cloud",
      "raining",
      "cloudraining04",
      "cloud raining 04",
      "cloudraining"
    ]
  },
  {
    "name": "CloudRaining05",
    "label": "Cloud Raining 05",
    "category": "Weather",
    "baseFamily": "CloudRaining",
    "isFirstVariant": false,
    "variantCount": 6,
    "familyVariants": [
      "CloudRaining01",
      "CloudRaining02",
      "CloudRaining03",
      "CloudRaining04",
      "CloudRaining05",
      "CloudRaining06"
    ],
    "tags": [
      "cloud",
      "raining",
      "cloudraining05",
      "cloud raining 05",
      "cloudraining"
    ]
  },
  {
    "name": "CloudRaining06",
    "label": "Cloud Raining 06",
    "category": "Weather",
    "baseFamily": "CloudRaining",
    "isFirstVariant": false,
    "variantCount": 6,
    "familyVariants": [
      "CloudRaining01",
      "CloudRaining02",
      "CloudRaining03",
      "CloudRaining04",
      "CloudRaining05",
      "CloudRaining06"
    ],
    "tags": [
      "cloud",
      "raining",
      "cloudraining06",
      "cloud raining 06",
      "cloudraining"
    ]
  },
  {
    "name": "CloudSnowing01",
    "label": "Cloud Snowing 01",
    "category": "Weather",
    "baseFamily": "CloudSnowing",
    "isFirstVariant": true,
    "variantCount": 2,
    "familyVariants": [
      "CloudSnowing01",
      "CloudSnowing02"
    ],
    "tags": [
      "cloud",
      "snowing",
      "cloudsnowing01",
      "cloud snowing 01",
      "cloudsnowing"
    ]
  },
  {
    "name": "CloudSnowing02",
    "label": "Cloud Snowing 02",
    "category": "Weather",
    "baseFamily": "CloudSnowing",
    "isFirstVariant": false,
    "variantCount": 2,
    "familyVariants": [
      "CloudSnowing01",
      "CloudSnowing02"
    ],
    "tags": [
      "cloud",
      "snowing",
      "cloudsnowing02",
      "cloud snowing 02",
      "cloudsnowing"
    ]
  },
  {
    "name": "CloudSun01",
    "label": "Cloud Sun 01",
    "category": "Weather",
    "baseFamily": "CloudSun",
    "isFirstVariant": true,
    "variantCount": 3,
    "familyVariants": [
      "CloudSun01",
      "CloudSun02",
      "CloudSun03"
    ],
    "tags": [
      "cloud",
      "sun",
      "cloudsun01",
      "cloud sun 01",
      "cloudsun"
    ]
  },
  {
    "name": "CloudSun02",
    "label": "Cloud Sun 02",
    "category": "Weather",
    "baseFamily": "CloudSun",
    "isFirstVariant": false,
    "variantCount": 3,
    "familyVariants": [
      "CloudSun01",
      "CloudSun02",
      "CloudSun03"
    ],
    "tags": [
      "cloud",
      "sun",
      "cloudsun02",
      "cloud sun 02",
      "cloudsun"
    ]
  },
  {
    "name": "CloudSun03",
    "label": "Cloud Sun 03",
    "category": "Weather",
    "baseFamily": "CloudSun",
    "isFirstVariant": false,
    "variantCount": 3,
    "familyVariants": [
      "CloudSun01",
      "CloudSun02",
      "CloudSun03"
    ],
    "tags": [
      "cloud",
      "sun",
      "cloudsun03",
      "cloud sun 03",
      "cloudsun"
    ]
  },
  {
    "name": "Code01",
    "label": "Code 01",
    "category": "Development",
    "baseFamily": "Code",
    "isFirstVariant": true,
    "variantCount": 2,
    "familyVariants": [
      "Code01",
      "Code02"
    ],
    "tags": [
      "code",
      "code01",
      "code 01"
    ]
  },
  {
    "name": "Code02",
    "label": "Code 02",
    "category": "Development",
    "baseFamily": "Code",
    "isFirstVariant": false,
    "variantCount": 2,
    "familyVariants": [
      "Code01",
      "Code02"
    ],
    "tags": [
      "code",
      "code02",
      "code 02"
    ]
  },
  {
    "name": "CodeBrowser",
    "label": "Code Browser",
    "category": "Development",
    "baseFamily": "CodeBrowser",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "CodeBrowser"
    ],
    "tags": [
      "code",
      "browser",
      "codebrowser",
      "code browser"
    ]
  },
  {
    "name": "CodeCircle01",
    "label": "Code Circle 01",
    "category": "Development",
    "baseFamily": "CodeCircle",
    "isFirstVariant": true,
    "variantCount": 3,
    "familyVariants": [
      "CodeCircle01",
      "CodeCircle02",
      "CodeCircle03"
    ],
    "tags": [
      "code",
      "circle",
      "codecircle01",
      "code circle 01",
      "codecircle"
    ]
  },
  {
    "name": "CodeCircle02",
    "label": "Code Circle 02",
    "category": "Development",
    "baseFamily": "CodeCircle",
    "isFirstVariant": false,
    "variantCount": 3,
    "familyVariants": [
      "CodeCircle01",
      "CodeCircle02",
      "CodeCircle03"
    ],
    "tags": [
      "code",
      "circle",
      "codecircle02",
      "code circle 02",
      "codecircle"
    ]
  },
  {
    "name": "CodeCircle03",
    "label": "Code Circle 03",
    "category": "Development",
    "baseFamily": "CodeCircle",
    "isFirstVariant": false,
    "variantCount": 3,
    "familyVariants": [
      "CodeCircle01",
      "CodeCircle02",
      "CodeCircle03"
    ],
    "tags": [
      "code",
      "circle",
      "codecircle03",
      "code circle 03",
      "codecircle"
    ]
  },
  {
    "name": "CodeSnippet01",
    "label": "Code Snippet 01",
    "category": "Development",
    "baseFamily": "CodeSnippet",
    "isFirstVariant": true,
    "variantCount": 2,
    "familyVariants": [
      "CodeSnippet01",
      "CodeSnippet02"
    ],
    "tags": [
      "code",
      "snippet",
      "codesnippet01",
      "code snippet 01",
      "codesnippet"
    ]
  },
  {
    "name": "CodeSnippet02",
    "label": "Code Snippet 02",
    "category": "Development",
    "baseFamily": "CodeSnippet",
    "isFirstVariant": false,
    "variantCount": 2,
    "familyVariants": [
      "CodeSnippet01",
      "CodeSnippet02"
    ],
    "tags": [
      "code",
      "snippet",
      "codesnippet02",
      "code snippet 02",
      "codesnippet"
    ]
  },
  {
    "name": "CodeSquare01",
    "label": "Code Square 01",
    "category": "Development",
    "baseFamily": "CodeSquare",
    "isFirstVariant": true,
    "variantCount": 2,
    "familyVariants": [
      "CodeSquare01",
      "CodeSquare02"
    ],
    "tags": [
      "code",
      "square",
      "codesquare01",
      "code square 01",
      "codesquare"
    ]
  },
  {
    "name": "CodeSquare02",
    "label": "Code Square 02",
    "category": "Development",
    "baseFamily": "CodeSquare",
    "isFirstVariant": false,
    "variantCount": 2,
    "familyVariants": [
      "CodeSquare01",
      "CodeSquare02"
    ],
    "tags": [
      "code",
      "square",
      "codesquare02",
      "code square 02",
      "codesquare"
    ]
  },
  {
    "name": "Codepen",
    "label": "Codepen",
    "category": "Development",
    "baseFamily": "Codepen",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "Codepen"
    ],
    "tags": [
      "codepen"
    ]
  },
  {
    "name": "Coins01",
    "label": "Coins 01",
    "category": "Finance & eCommerce",
    "baseFamily": "Coins",
    "isFirstVariant": true,
    "variantCount": 4,
    "familyVariants": [
      "Coins01",
      "Coins02",
      "Coins03",
      "Coins04"
    ],
    "tags": [
      "coins",
      "money",
      "change",
      "cents",
      "cash",
      "income",
      "currency",
      "intake",
      "paid",
      "savings",
      "revenue",
      "coins01",
      "coins 01"
    ]
  },
  {
    "name": "Coins02",
    "label": "Coins 02",
    "category": "Finance & eCommerce",
    "baseFamily": "Coins",
    "isFirstVariant": false,
    "variantCount": 4,
    "familyVariants": [
      "Coins01",
      "Coins02",
      "Coins03",
      "Coins04"
    ],
    "tags": [
      "coins",
      "money",
      "change",
      "cents",
      "cash",
      "income",
      "currency",
      "intake",
      "paid",
      "savings",
      "revenue",
      "coins02",
      "coins 02"
    ]
  },
  {
    "name": "Coins03",
    "label": "Coins 03",
    "category": "Finance & eCommerce",
    "baseFamily": "Coins",
    "isFirstVariant": false,
    "variantCount": 4,
    "familyVariants": [
      "Coins01",
      "Coins02",
      "Coins03",
      "Coins04"
    ],
    "tags": [
      "coins",
      "money",
      "change",
      "cents",
      "cash",
      "income",
      "currency",
      "intake",
      "paid",
      "savings",
      "revenue",
      "coins03",
      "coins 03"
    ]
  },
  {
    "name": "Coins04",
    "label": "Coins 04",
    "category": "Finance & eCommerce",
    "baseFamily": "Coins",
    "isFirstVariant": false,
    "variantCount": 4,
    "familyVariants": [
      "Coins01",
      "Coins02",
      "Coins03",
      "Coins04"
    ],
    "tags": [
      "coins",
      "money",
      "change",
      "cents",
      "cash",
      "income",
      "currency",
      "intake",
      "paid",
      "savings",
      "revenue",
      "coins04",
      "coins 04"
    ]
  },
  {
    "name": "CoinsHand",
    "label": "Coins Hand",
    "category": "Finance & eCommerce",
    "baseFamily": "CoinsHand",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "CoinsHand"
    ],
    "tags": [
      "coins",
      "hand",
      "coinshand",
      "coins hand"
    ]
  },
  {
    "name": "CoinsStacked01",
    "label": "Coins Stacked 01",
    "category": "Finance & eCommerce",
    "baseFamily": "CoinsStacked",
    "isFirstVariant": true,
    "variantCount": 4,
    "familyVariants": [
      "CoinsStacked01",
      "CoinsStacked02",
      "CoinsStacked03",
      "CoinsStacked04"
    ],
    "tags": [
      "coins",
      "stacked",
      "wealth",
      "stack",
      "gold",
      "capital",
      "balance",
      "dividend",
      "interest",
      "treasury",
      "coinsstacked01",
      "coins stacked 01",
      "coinsstacked"
    ]
  },
  {
    "name": "CoinsStacked02",
    "label": "Coins Stacked 02",
    "category": "Finance & eCommerce",
    "baseFamily": "CoinsStacked",
    "isFirstVariant": false,
    "variantCount": 4,
    "familyVariants": [
      "CoinsStacked01",
      "CoinsStacked02",
      "CoinsStacked03",
      "CoinsStacked04"
    ],
    "tags": [
      "coins",
      "stacked",
      "wealth",
      "stack",
      "gold",
      "capital",
      "balance",
      "dividend",
      "interest",
      "treasury",
      "coinsstacked02",
      "coins stacked 02",
      "coinsstacked"
    ]
  },
  {
    "name": "CoinsStacked03",
    "label": "Coins Stacked 03",
    "category": "Finance & eCommerce",
    "baseFamily": "CoinsStacked",
    "isFirstVariant": false,
    "variantCount": 4,
    "familyVariants": [
      "CoinsStacked01",
      "CoinsStacked02",
      "CoinsStacked03",
      "CoinsStacked04"
    ],
    "tags": [
      "coins",
      "stacked",
      "wealth",
      "stack",
      "gold",
      "capital",
      "balance",
      "dividend",
      "interest",
      "treasury",
      "coinsstacked03",
      "coins stacked 03",
      "coinsstacked"
    ]
  },
  {
    "name": "CoinsStacked04",
    "label": "Coins Stacked 04",
    "category": "Finance & eCommerce",
    "baseFamily": "CoinsStacked",
    "isFirstVariant": false,
    "variantCount": 4,
    "familyVariants": [
      "CoinsStacked01",
      "CoinsStacked02",
      "CoinsStacked03",
      "CoinsStacked04"
    ],
    "tags": [
      "coins",
      "stacked",
      "wealth",
      "stack",
      "gold",
      "capital",
      "balance",
      "dividend",
      "interest",
      "treasury",
      "coinsstacked04",
      "coins stacked 04",
      "coinsstacked"
    ]
  },
  {
    "name": "CoinsSwap01",
    "label": "Coins Swap 01",
    "category": "Finance & eCommerce",
    "baseFamily": "CoinsSwap",
    "isFirstVariant": true,
    "variantCount": 2,
    "familyVariants": [
      "CoinsSwap01",
      "CoinsSwap02"
    ],
    "tags": [
      "coins",
      "swap",
      "coinsswap01",
      "coins swap 01",
      "coinsswap"
    ]
  },
  {
    "name": "CoinsSwap02",
    "label": "Coins Swap 02",
    "category": "Finance & eCommerce",
    "baseFamily": "CoinsSwap",
    "isFirstVariant": false,
    "variantCount": 2,
    "familyVariants": [
      "CoinsSwap01",
      "CoinsSwap02"
    ],
    "tags": [
      "coins",
      "swap",
      "coinsswap02",
      "coins swap 02",
      "coinsswap"
    ]
  },
  {
    "name": "Colors",
    "label": "Colors",
    "category": "Images",
    "baseFamily": "Colors",
    "isFirstVariant": false,
    "variantCount": 2,
    "familyVariants": [
      "Colors",
      "Colors1"
    ],
    "tags": [
      "colors"
    ]
  },
  {
    "name": "Colors1",
    "label": "Colors 1",
    "category": "Images",
    "baseFamily": "Colors",
    "isFirstVariant": true,
    "variantCount": 2,
    "familyVariants": [
      "Colors",
      "Colors1"
    ],
    "tags": [
      "colors",
      "colors1",
      "colors 1"
    ]
  },
  {
    "name": "Columns01",
    "label": "Columns 01",
    "category": "Layout",
    "baseFamily": "Columns",
    "isFirstVariant": true,
    "variantCount": 3,
    "familyVariants": [
      "Columns01",
      "Columns02",
      "Columns03"
    ],
    "tags": [
      "columns",
      "columns01",
      "columns 01"
    ]
  },
  {
    "name": "Columns02",
    "label": "Columns 02",
    "category": "Layout",
    "baseFamily": "Columns",
    "isFirstVariant": false,
    "variantCount": 3,
    "familyVariants": [
      "Columns01",
      "Columns02",
      "Columns03"
    ],
    "tags": [
      "columns",
      "columns02",
      "columns 02"
    ]
  },
  {
    "name": "Columns03",
    "label": "Columns 03",
    "category": "Layout",
    "baseFamily": "Columns",
    "isFirstVariant": false,
    "variantCount": 3,
    "familyVariants": [
      "Columns01",
      "Columns02",
      "Columns03"
    ],
    "tags": [
      "columns",
      "columns03",
      "columns 03"
    ]
  },
  {
    "name": "Command",
    "label": "Command",
    "category": "General",
    "baseFamily": "Command",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "Command"
    ],
    "tags": [
      "command"
    ]
  },
  {
    "name": "Compass",
    "label": "Compass",
    "category": "Maps & travel",
    "baseFamily": "Compass",
    "isFirstVariant": false,
    "variantCount": 4,
    "familyVariants": [
      "Compass",
      "Compass01",
      "Compass02",
      "Compass03"
    ],
    "tags": [
      "compass"
    ]
  },
  {
    "name": "Compass01",
    "label": "Compass 01",
    "category": "Maps & travel",
    "baseFamily": "Compass",
    "isFirstVariant": true,
    "variantCount": 4,
    "familyVariants": [
      "Compass",
      "Compass01",
      "Compass02",
      "Compass03"
    ],
    "tags": [
      "compass",
      "explore",
      "travel",
      "adventure",
      "direction",
      "navigation",
      "tour",
      "discovery",
      "compass01",
      "compass 01"
    ]
  },
  {
    "name": "Compass02",
    "label": "Compass 02",
    "category": "Maps & travel",
    "baseFamily": "Compass",
    "isFirstVariant": false,
    "variantCount": 4,
    "familyVariants": [
      "Compass",
      "Compass01",
      "Compass02",
      "Compass03"
    ],
    "tags": [
      "compass",
      "explore",
      "travel",
      "adventure",
      "direction",
      "navigation",
      "tour",
      "compass02",
      "compass 02"
    ]
  },
  {
    "name": "Compass03",
    "label": "Compass 03",
    "category": "Maps & travel",
    "baseFamily": "Compass",
    "isFirstVariant": false,
    "variantCount": 4,
    "familyVariants": [
      "Compass",
      "Compass01",
      "Compass02",
      "Compass03"
    ],
    "tags": [
      "compass",
      "explore",
      "travel",
      "adventure",
      "direction",
      "navigation",
      "tour",
      "compass03",
      "compass 03"
    ]
  },
  {
    "name": "Container",
    "label": "Container",
    "category": "General",
    "baseFamily": "Container",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "Container"
    ],
    "tags": [
      "container"
    ]
  },
  {
    "name": "Contrast01",
    "label": "Contrast 01",
    "category": "Images",
    "baseFamily": "Contrast",
    "isFirstVariant": true,
    "variantCount": 3,
    "familyVariants": [
      "Contrast01",
      "Contrast02",
      "Contrast03"
    ],
    "tags": [
      "contrast",
      "contrast01",
      "contrast 01"
    ]
  },
  {
    "name": "Contrast02",
    "label": "Contrast 02",
    "category": "Images",
    "baseFamily": "Contrast",
    "isFirstVariant": false,
    "variantCount": 3,
    "familyVariants": [
      "Contrast01",
      "Contrast02",
      "Contrast03"
    ],
    "tags": [
      "contrast",
      "contrast02",
      "contrast 02"
    ]
  },
  {
    "name": "Contrast03",
    "label": "Contrast 03",
    "category": "Images",
    "baseFamily": "Contrast",
    "isFirstVariant": false,
    "variantCount": 3,
    "familyVariants": [
      "Contrast01",
      "Contrast02",
      "Contrast03"
    ],
    "tags": [
      "contrast",
      "contrast03",
      "contrast 03"
    ]
  },
  {
    "name": "Copy01",
    "label": "Copy 01",
    "category": "Editor",
    "baseFamily": "Copy",
    "isFirstVariant": true,
    "variantCount": 7,
    "familyVariants": [
      "Copy01",
      "Copy02",
      "Copy03",
      "Copy04",
      "Copy05",
      "Copy06",
      "Copy07"
    ],
    "tags": [
      "copy",
      "copy01",
      "copy 01"
    ]
  },
  {
    "name": "Copy02",
    "label": "Copy 02",
    "category": "Editor",
    "baseFamily": "Copy",
    "isFirstVariant": false,
    "variantCount": 7,
    "familyVariants": [
      "Copy01",
      "Copy02",
      "Copy03",
      "Copy04",
      "Copy05",
      "Copy06",
      "Copy07"
    ],
    "tags": [
      "copy",
      "copy02",
      "copy 02"
    ]
  },
  {
    "name": "Copy03",
    "label": "Copy 03",
    "category": "Editor",
    "baseFamily": "Copy",
    "isFirstVariant": false,
    "variantCount": 7,
    "familyVariants": [
      "Copy01",
      "Copy02",
      "Copy03",
      "Copy04",
      "Copy05",
      "Copy06",
      "Copy07"
    ],
    "tags": [
      "copy",
      "copy03",
      "copy 03"
    ]
  },
  {
    "name": "Copy04",
    "label": "Copy 04",
    "category": "Editor",
    "baseFamily": "Copy",
    "isFirstVariant": false,
    "variantCount": 7,
    "familyVariants": [
      "Copy01",
      "Copy02",
      "Copy03",
      "Copy04",
      "Copy05",
      "Copy06",
      "Copy07"
    ],
    "tags": [
      "copy",
      "copy04",
      "copy 04"
    ]
  },
  {
    "name": "Copy05",
    "label": "Copy 05",
    "category": "Editor",
    "baseFamily": "Copy",
    "isFirstVariant": false,
    "variantCount": 7,
    "familyVariants": [
      "Copy01",
      "Copy02",
      "Copy03",
      "Copy04",
      "Copy05",
      "Copy06",
      "Copy07"
    ],
    "tags": [
      "copy",
      "copy05",
      "copy 05"
    ]
  },
  {
    "name": "Copy06",
    "label": "Copy 06",
    "category": "Editor",
    "baseFamily": "Copy",
    "isFirstVariant": false,
    "variantCount": 7,
    "familyVariants": [
      "Copy01",
      "Copy02",
      "Copy03",
      "Copy04",
      "Copy05",
      "Copy06",
      "Copy07"
    ],
    "tags": [
      "copy",
      "copy06",
      "copy 06"
    ]
  },
  {
    "name": "Copy07",
    "label": "Copy 07",
    "category": "Editor",
    "baseFamily": "Copy",
    "isFirstVariant": false,
    "variantCount": 7,
    "familyVariants": [
      "Copy01",
      "Copy02",
      "Copy03",
      "Copy04",
      "Copy05",
      "Copy06",
      "Copy07"
    ],
    "tags": [
      "copy",
      "copy07",
      "copy 07"
    ]
  },
  {
    "name": "CornerDownLeft",
    "label": "Corner Down Left",
    "category": "Arrows",
    "baseFamily": "CornerDownLeft",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "CornerDownLeft"
    ],
    "tags": [
      "corner",
      "down",
      "left",
      "cornerdownleft",
      "corner down left"
    ]
  },
  {
    "name": "CornerDownRight",
    "label": "Corner Down Right",
    "category": "Arrows",
    "baseFamily": "CornerDownRight",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "CornerDownRight"
    ],
    "tags": [
      "corner",
      "down",
      "right",
      "cornerdownright",
      "corner down right"
    ]
  },
  {
    "name": "CornerLeftDown",
    "label": "Corner Left Down",
    "category": "Arrows",
    "baseFamily": "CornerLeftDown",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "CornerLeftDown"
    ],
    "tags": [
      "corner",
      "left",
      "down",
      "cornerleftdown",
      "corner left down"
    ]
  },
  {
    "name": "CornerLeftUp",
    "label": "Corner Left Up",
    "category": "Arrows",
    "baseFamily": "CornerLeftUp",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "CornerLeftUp"
    ],
    "tags": [
      "corner",
      "left",
      "up",
      "cornerleftup",
      "corner left up"
    ]
  },
  {
    "name": "CornerRightDown",
    "label": "Corner Right Down",
    "category": "Arrows",
    "baseFamily": "CornerRightDown",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "CornerRightDown"
    ],
    "tags": [
      "corner",
      "right",
      "down",
      "cornerrightdown",
      "corner right down"
    ]
  },
  {
    "name": "CornerRightUp",
    "label": "Corner Right Up",
    "category": "Arrows",
    "baseFamily": "CornerRightUp",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "CornerRightUp"
    ],
    "tags": [
      "corner",
      "right",
      "up",
      "cornerrightup",
      "corner right up"
    ]
  },
  {
    "name": "CornerUpLeft",
    "label": "Corner Up Left",
    "category": "Arrows",
    "baseFamily": "CornerUpLeft",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "CornerUpLeft"
    ],
    "tags": [
      "corner",
      "up",
      "left",
      "cornerupleft",
      "corner up left"
    ]
  },
  {
    "name": "CornerUpRight",
    "label": "Corner Up Right",
    "category": "Arrows",
    "baseFamily": "CornerUpRight",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "CornerUpRight"
    ],
    "tags": [
      "corner",
      "up",
      "right",
      "cornerupright",
      "corner up right"
    ]
  },
  {
    "name": "CpuChip01",
    "label": "Cpu Chip 01",
    "category": "Media & devices",
    "baseFamily": "CpuChip",
    "isFirstVariant": true,
    "variantCount": 2,
    "familyVariants": [
      "CpuChip01",
      "CpuChip02"
    ],
    "tags": [
      "cpu",
      "chip",
      "cpuchip01",
      "cpu chip 01",
      "cpuchip"
    ]
  },
  {
    "name": "CpuChip02",
    "label": "Cpu Chip 02",
    "category": "Media & devices",
    "baseFamily": "CpuChip",
    "isFirstVariant": false,
    "variantCount": 2,
    "familyVariants": [
      "CpuChip01",
      "CpuChip02"
    ],
    "tags": [
      "cpu",
      "chip",
      "cpuchip02",
      "cpu chip 02",
      "cpuchip"
    ]
  },
  {
    "name": "CreditCard01",
    "label": "Credit Card 01",
    "category": "Finance & eCommerce",
    "baseFamily": "CreditCard",
    "isFirstVariant": true,
    "variantCount": 2,
    "familyVariants": [
      "CreditCard01",
      "CreditCard02"
    ],
    "tags": [
      "credit",
      "card",
      "visa",
      "mastercard",
      "amex",
      "payment",
      "spend",
      "debit",
      "subscription",
      "creditcard01",
      "credit card 01",
      "creditcard"
    ]
  },
  {
    "name": "CreditCard02",
    "label": "Credit Card 02",
    "category": "Finance & eCommerce",
    "baseFamily": "CreditCard",
    "isFirstVariant": false,
    "variantCount": 2,
    "familyVariants": [
      "CreditCard01",
      "CreditCard02"
    ],
    "tags": [
      "credit",
      "card",
      "visa",
      "mastercard",
      "amex",
      "payment",
      "spend",
      "debit",
      "creditcard02",
      "credit card 02",
      "creditcard"
    ]
  },
  {
    "name": "CreditCardCheck",
    "label": "Credit Card Check",
    "category": "Finance & eCommerce",
    "baseFamily": "CreditCardCheck",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "CreditCardCheck"
    ],
    "tags": [
      "credit",
      "card",
      "check",
      "cleared card",
      "approved payment",
      "verified card",
      "paid",
      "creditcardcheck",
      "credit card check"
    ]
  },
  {
    "name": "CreditCardDown",
    "label": "Credit Card Down",
    "category": "Finance & eCommerce",
    "baseFamily": "CreditCardDown",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "CreditCardDown"
    ],
    "tags": [
      "credit",
      "card",
      "down",
      "withdrawal",
      "card expense",
      "spending",
      "creditcarddown",
      "credit card down"
    ]
  },
  {
    "name": "CreditCardDownload",
    "label": "Credit Card Download",
    "category": "Finance & eCommerce",
    "baseFamily": "CreditCardDownload",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "CreditCardDownload"
    ],
    "tags": [
      "credit",
      "card",
      "download",
      "creditcarddownload",
      "credit card download"
    ]
  },
  {
    "name": "CreditCardEdit",
    "label": "Credit Card Edit",
    "category": "Finance & eCommerce",
    "baseFamily": "CreditCardEdit",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "CreditCardEdit"
    ],
    "tags": [
      "credit",
      "card",
      "edit",
      "update card",
      "modify card",
      "creditcardedit",
      "credit card edit"
    ]
  },
  {
    "name": "CreditCardLock",
    "label": "Credit Card Lock",
    "category": "Finance & eCommerce",
    "baseFamily": "CreditCardLock",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "CreditCardLock"
    ],
    "tags": [
      "credit",
      "card",
      "lock",
      "creditcardlock",
      "credit card lock"
    ]
  },
  {
    "name": "CreditCardMinus",
    "label": "Credit Card Minus",
    "category": "Finance & eCommerce",
    "baseFamily": "CreditCardMinus",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "CreditCardMinus"
    ],
    "tags": [
      "credit",
      "card",
      "minus",
      "remove card",
      "delete payment method",
      "creditcardminus",
      "credit card minus"
    ]
  },
  {
    "name": "CreditCardPlus",
    "label": "Credit Card Plus",
    "category": "Finance & eCommerce",
    "baseFamily": "CreditCardPlus",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "CreditCardPlus"
    ],
    "tags": [
      "credit",
      "card",
      "plus",
      "add card",
      "new payment method",
      "link card",
      "creditcardplus",
      "credit card plus"
    ]
  },
  {
    "name": "CreditCardRefresh",
    "label": "Credit Card Refresh",
    "category": "Finance & eCommerce",
    "baseFamily": "CreditCardRefresh",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "CreditCardRefresh"
    ],
    "tags": [
      "credit",
      "card",
      "refresh",
      "renew card",
      "auto renewal",
      "recurring payment",
      "creditcardrefresh",
      "credit card refresh"
    ]
  },
  {
    "name": "CreditCardSearch",
    "label": "Credit Card Search",
    "category": "Finance & eCommerce",
    "baseFamily": "CreditCardSearch",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "CreditCardSearch"
    ],
    "tags": [
      "credit",
      "card",
      "search",
      "creditcardsearch",
      "credit card search"
    ]
  },
  {
    "name": "CreditCardShield",
    "label": "Credit Card Shield",
    "category": "Finance & eCommerce",
    "baseFamily": "CreditCardShield",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "CreditCardShield"
    ],
    "tags": [
      "credit",
      "card",
      "shield",
      "secure payment",
      "fraud protection",
      "safe checkout",
      "creditcardshield",
      "credit card shield"
    ]
  },
  {
    "name": "CreditCardUp",
    "label": "Credit Card Up",
    "category": "Finance & eCommerce",
    "baseFamily": "CreditCardUp",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "CreditCardUp"
    ],
    "tags": [
      "credit",
      "card",
      "up",
      "deposit",
      "card credit",
      "top up",
      "creditcardup",
      "credit card up"
    ]
  },
  {
    "name": "CreditCardUpload",
    "label": "Credit Card Upload",
    "category": "Finance & eCommerce",
    "baseFamily": "CreditCardUpload",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "CreditCardUpload"
    ],
    "tags": [
      "credit",
      "card",
      "upload",
      "creditcardupload",
      "credit card upload"
    ]
  },
  {
    "name": "CreditCardX",
    "label": "Credit Card X",
    "category": "Finance & eCommerce",
    "baseFamily": "CreditCardX",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "CreditCardX"
    ],
    "tags": [
      "credit",
      "card",
      "x",
      "declined",
      "expired card",
      "blocked card",
      "creditcardx",
      "credit card x"
    ]
  },
  {
    "name": "Crop01",
    "label": "Crop 01",
    "category": "Images",
    "baseFamily": "Crop",
    "isFirstVariant": true,
    "variantCount": 2,
    "familyVariants": [
      "Crop01",
      "Crop02"
    ],
    "tags": [
      "crop",
      "crop01",
      "crop 01"
    ]
  },
  {
    "name": "Crop02",
    "label": "Crop 02",
    "category": "Images",
    "baseFamily": "Crop",
    "isFirstVariant": false,
    "variantCount": 2,
    "familyVariants": [
      "Crop01",
      "Crop02"
    ],
    "tags": [
      "crop",
      "crop02",
      "crop 02"
    ]
  },
  {
    "name": "Cryptocurrency01",
    "label": "Cryptocurrency 01",
    "category": "Finance & eCommerce",
    "baseFamily": "Cryptocurrency",
    "isFirstVariant": true,
    "variantCount": 4,
    "familyVariants": [
      "Cryptocurrency01",
      "Cryptocurrency02",
      "Cryptocurrency03",
      "Cryptocurrency04"
    ],
    "tags": [
      "cryptocurrency",
      "cryptocurrency01",
      "cryptocurrency 01"
    ]
  },
  {
    "name": "Cryptocurrency02",
    "label": "Cryptocurrency 02",
    "category": "Finance & eCommerce",
    "baseFamily": "Cryptocurrency",
    "isFirstVariant": false,
    "variantCount": 4,
    "familyVariants": [
      "Cryptocurrency01",
      "Cryptocurrency02",
      "Cryptocurrency03",
      "Cryptocurrency04"
    ],
    "tags": [
      "cryptocurrency",
      "cryptocurrency02",
      "cryptocurrency 02"
    ]
  },
  {
    "name": "Cryptocurrency03",
    "label": "Cryptocurrency 03",
    "category": "Finance & eCommerce",
    "baseFamily": "Cryptocurrency",
    "isFirstVariant": false,
    "variantCount": 4,
    "familyVariants": [
      "Cryptocurrency01",
      "Cryptocurrency02",
      "Cryptocurrency03",
      "Cryptocurrency04"
    ],
    "tags": [
      "cryptocurrency",
      "cryptocurrency03",
      "cryptocurrency 03"
    ]
  },
  {
    "name": "Cryptocurrency04",
    "label": "Cryptocurrency 04",
    "category": "Finance & eCommerce",
    "baseFamily": "Cryptocurrency",
    "isFirstVariant": false,
    "variantCount": 4,
    "familyVariants": [
      "Cryptocurrency01",
      "Cryptocurrency02",
      "Cryptocurrency03",
      "Cryptocurrency04"
    ],
    "tags": [
      "cryptocurrency",
      "cryptocurrency04",
      "cryptocurrency 04"
    ]
  },
  {
    "name": "Cube01",
    "label": "Cube 01",
    "category": "Shapes",
    "baseFamily": "Cube",
    "isFirstVariant": true,
    "variantCount": 4,
    "familyVariants": [
      "Cube01",
      "Cube02",
      "Cube03",
      "Cube04"
    ],
    "tags": [
      "cube",
      "cube01",
      "cube 01"
    ]
  },
  {
    "name": "Cube02",
    "label": "Cube 02",
    "category": "Shapes",
    "baseFamily": "Cube",
    "isFirstVariant": false,
    "variantCount": 4,
    "familyVariants": [
      "Cube01",
      "Cube02",
      "Cube03",
      "Cube04"
    ],
    "tags": [
      "cube",
      "cube02",
      "cube 02"
    ]
  },
  {
    "name": "Cube03",
    "label": "Cube 03",
    "category": "Shapes",
    "baseFamily": "Cube",
    "isFirstVariant": false,
    "variantCount": 4,
    "familyVariants": [
      "Cube01",
      "Cube02",
      "Cube03",
      "Cube04"
    ],
    "tags": [
      "cube",
      "cube03",
      "cube 03"
    ]
  },
  {
    "name": "Cube04",
    "label": "Cube 04",
    "category": "Shapes",
    "baseFamily": "Cube",
    "isFirstVariant": false,
    "variantCount": 4,
    "familyVariants": [
      "Cube01",
      "Cube02",
      "Cube03",
      "Cube04"
    ],
    "tags": [
      "cube",
      "cube04",
      "cube 04"
    ]
  },
  {
    "name": "CubeOutline",
    "label": "Cube Outline",
    "category": "Shapes",
    "baseFamily": "CubeOutline",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "CubeOutline"
    ],
    "tags": [
      "cube",
      "outline",
      "cubeoutline",
      "cube outline"
    ]
  },
  {
    "name": "CurrencyBitcoin",
    "label": "Currency Bitcoin",
    "category": "Finance & eCommerce",
    "baseFamily": "CurrencyBitcoin",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "CurrencyBitcoin"
    ],
    "tags": [
      "currency",
      "bitcoin",
      "btc",
      "crypto",
      "blockchain",
      "token",
      "satoshi",
      "cryptocurrency",
      "currencybitcoin",
      "currency bitcoin"
    ]
  },
  {
    "name": "CurrencyBitcoinCircle",
    "label": "Currency Bitcoin Circle",
    "category": "Finance & eCommerce",
    "baseFamily": "CurrencyBitcoinCircle",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "CurrencyBitcoinCircle"
    ],
    "tags": [
      "currency",
      "bitcoin",
      "circle",
      "currencybitcoincircle",
      "currency bitcoin circle"
    ]
  },
  {
    "name": "CurrencyDollar",
    "label": "Currency Dollar",
    "category": "Finance & eCommerce",
    "baseFamily": "CurrencyDollar",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "CurrencyDollar"
    ],
    "tags": [
      "currency",
      "dollar",
      "usd",
      "buck",
      "price",
      "money",
      "dollar sign",
      "cash",
      "united states",
      "currencydollar",
      "currency dollar"
    ]
  },
  {
    "name": "CurrencyDollarCircle",
    "label": "Currency Dollar Circle",
    "category": "Finance & eCommerce",
    "baseFamily": "CurrencyDollarCircle",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "CurrencyDollarCircle"
    ],
    "tags": [
      "currency",
      "dollar",
      "circle",
      "currencydollarcircle",
      "currency dollar circle"
    ]
  },
  {
    "name": "CurrencyEthereum",
    "label": "Currency Ethereum",
    "category": "Finance & eCommerce",
    "baseFamily": "CurrencyEthereum",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "CurrencyEthereum"
    ],
    "tags": [
      "currency",
      "ethereum",
      "eth",
      "crypto",
      "smart contract",
      "token",
      "cryptocurrency",
      "currencyethereum",
      "currency ethereum"
    ]
  },
  {
    "name": "CurrencyEthereumCircle",
    "label": "Currency Ethereum Circle",
    "category": "Finance & eCommerce",
    "baseFamily": "CurrencyEthereumCircle",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "CurrencyEthereumCircle"
    ],
    "tags": [
      "currency",
      "ethereum",
      "circle",
      "currencyethereumcircle",
      "currency ethereum circle"
    ]
  },
  {
    "name": "CurrencyEuro",
    "label": "Currency Euro",
    "category": "Finance & eCommerce",
    "baseFamily": "CurrencyEuro",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "CurrencyEuro"
    ],
    "tags": [
      "currency",
      "euro",
      "eur",
      "euro sign",
      "european money",
      "europe",
      "currencyeuro",
      "currency euro"
    ]
  },
  {
    "name": "CurrencyEuroCircle",
    "label": "Currency Euro Circle",
    "category": "Finance & eCommerce",
    "baseFamily": "CurrencyEuroCircle",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "CurrencyEuroCircle"
    ],
    "tags": [
      "currency",
      "euro",
      "circle",
      "currencyeurocircle",
      "currency euro circle"
    ]
  },
  {
    "name": "CurrencyPound",
    "label": "Currency Pound",
    "category": "Finance & eCommerce",
    "baseFamily": "CurrencyPound",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "CurrencyPound"
    ],
    "tags": [
      "currency",
      "pound",
      "gbp",
      "quid",
      "british pound",
      "uk",
      "sterling",
      "currencypound",
      "currency pound"
    ]
  },
  {
    "name": "CurrencyPoundCircle",
    "label": "Currency Pound Circle",
    "category": "Finance & eCommerce",
    "baseFamily": "CurrencyPoundCircle",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "CurrencyPoundCircle"
    ],
    "tags": [
      "currency",
      "pound",
      "circle",
      "currencypoundcircle",
      "currency pound circle"
    ]
  },
  {
    "name": "CurrencyRuble",
    "label": "Currency Ruble",
    "category": "Finance & eCommerce",
    "baseFamily": "CurrencyRuble",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "CurrencyRuble"
    ],
    "tags": [
      "currency",
      "ruble",
      "rub",
      "russia",
      "rubles",
      "currencyruble",
      "currency ruble"
    ]
  },
  {
    "name": "CurrencyRubleCircle",
    "label": "Currency Ruble Circle",
    "category": "Finance & eCommerce",
    "baseFamily": "CurrencyRubleCircle",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "CurrencyRubleCircle"
    ],
    "tags": [
      "currency",
      "ruble",
      "circle",
      "currencyrublecircle",
      "currency ruble circle"
    ]
  },
  {
    "name": "CurrencyRupee",
    "label": "Currency Rupee",
    "category": "Finance & eCommerce",
    "baseFamily": "CurrencyRupee",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "CurrencyRupee"
    ],
    "tags": [
      "currency",
      "rupee",
      "inr",
      "india",
      "rupees",
      "currencyrupee",
      "currency rupee"
    ]
  },
  {
    "name": "CurrencyRupeeCircle",
    "label": "Currency Rupee Circle",
    "category": "Finance & eCommerce",
    "baseFamily": "CurrencyRupeeCircle",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "CurrencyRupeeCircle"
    ],
    "tags": [
      "currency",
      "rupee",
      "circle",
      "currencyrupeecircle",
      "currency rupee circle"
    ]
  },
  {
    "name": "CurrencyYen",
    "label": "Currency Yen",
    "category": "Finance & eCommerce",
    "baseFamily": "CurrencyYen",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "CurrencyYen"
    ],
    "tags": [
      "currency",
      "yen",
      "jpy",
      "cny",
      "yuan",
      "japan",
      "china",
      "currencyyen",
      "currency yen"
    ]
  },
  {
    "name": "CurrencyYenCircle",
    "label": "Currency Yen Circle",
    "category": "Finance & eCommerce",
    "baseFamily": "CurrencyYenCircle",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "CurrencyYenCircle"
    ],
    "tags": [
      "currency",
      "yen",
      "circle",
      "currencyyencircle",
      "currency yen circle"
    ]
  },
  {
    "name": "Cursor01",
    "label": "Cursor 01",
    "category": "Editor",
    "baseFamily": "Cursor",
    "isFirstVariant": true,
    "variantCount": 4,
    "familyVariants": [
      "Cursor01",
      "Cursor02",
      "Cursor03",
      "Cursor04"
    ],
    "tags": [
      "cursor",
      "cursor01",
      "cursor 01"
    ]
  },
  {
    "name": "Cursor02",
    "label": "Cursor 02",
    "category": "Editor",
    "baseFamily": "Cursor",
    "isFirstVariant": false,
    "variantCount": 4,
    "familyVariants": [
      "Cursor01",
      "Cursor02",
      "Cursor03",
      "Cursor04"
    ],
    "tags": [
      "cursor",
      "cursor02",
      "cursor 02"
    ]
  },
  {
    "name": "Cursor03",
    "label": "Cursor 03",
    "category": "Editor",
    "baseFamily": "Cursor",
    "isFirstVariant": false,
    "variantCount": 4,
    "familyVariants": [
      "Cursor01",
      "Cursor02",
      "Cursor03",
      "Cursor04"
    ],
    "tags": [
      "cursor",
      "cursor03",
      "cursor 03"
    ]
  },
  {
    "name": "Cursor04",
    "label": "Cursor 04",
    "category": "Editor",
    "baseFamily": "Cursor",
    "isFirstVariant": false,
    "variantCount": 4,
    "familyVariants": [
      "Cursor01",
      "Cursor02",
      "Cursor03",
      "Cursor04"
    ],
    "tags": [
      "cursor",
      "cursor04",
      "cursor 04"
    ]
  },
  {
    "name": "CursorBox",
    "label": "Cursor Box",
    "category": "Editor",
    "baseFamily": "CursorBox",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "CursorBox"
    ],
    "tags": [
      "cursor",
      "box",
      "cursorbox",
      "cursor box"
    ]
  },
  {
    "name": "CursorClick01",
    "label": "Cursor Click 01",
    "category": "Editor",
    "baseFamily": "CursorClick",
    "isFirstVariant": true,
    "variantCount": 2,
    "familyVariants": [
      "CursorClick01",
      "CursorClick02"
    ],
    "tags": [
      "cursor",
      "click",
      "cursorclick01",
      "cursor click 01",
      "cursorclick"
    ]
  },
  {
    "name": "CursorClick02",
    "label": "Cursor Click 02",
    "category": "Editor",
    "baseFamily": "CursorClick",
    "isFirstVariant": false,
    "variantCount": 2,
    "familyVariants": [
      "CursorClick01",
      "CursorClick02"
    ],
    "tags": [
      "cursor",
      "click",
      "cursorclick02",
      "cursor click 02",
      "cursorclick"
    ]
  },
  {
    "name": "Data",
    "label": "Data",
    "category": "Development",
    "baseFamily": "Data",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "Data"
    ],
    "tags": [
      "data"
    ]
  },
  {
    "name": "Database01",
    "label": "Database 01",
    "category": "Development",
    "baseFamily": "Database",
    "isFirstVariant": true,
    "variantCount": 3,
    "familyVariants": [
      "Database01",
      "Database02",
      "Database03"
    ],
    "tags": [
      "database",
      "database01",
      "database 01"
    ]
  },
  {
    "name": "Database02",
    "label": "Database 02",
    "category": "Development",
    "baseFamily": "Database",
    "isFirstVariant": false,
    "variantCount": 3,
    "familyVariants": [
      "Database01",
      "Database02",
      "Database03"
    ],
    "tags": [
      "database",
      "database02",
      "database 02"
    ]
  },
  {
    "name": "Database03",
    "label": "Database 03",
    "category": "Development",
    "baseFamily": "Database",
    "isFirstVariant": false,
    "variantCount": 3,
    "familyVariants": [
      "Database01",
      "Database02",
      "Database03"
    ],
    "tags": [
      "database",
      "database03",
      "database 03"
    ]
  },
  {
    "name": "Dataflow01",
    "label": "Dataflow 01",
    "category": "Development",
    "baseFamily": "Dataflow",
    "isFirstVariant": true,
    "variantCount": 4,
    "familyVariants": [
      "Dataflow01",
      "Dataflow02",
      "Dataflow03",
      "Dataflow04"
    ],
    "tags": [
      "dataflow",
      "dataflow01",
      "dataflow 01"
    ]
  },
  {
    "name": "Dataflow02",
    "label": "Dataflow 02",
    "category": "Development",
    "baseFamily": "Dataflow",
    "isFirstVariant": false,
    "variantCount": 4,
    "familyVariants": [
      "Dataflow01",
      "Dataflow02",
      "Dataflow03",
      "Dataflow04"
    ],
    "tags": [
      "dataflow",
      "dataflow02",
      "dataflow 02"
    ]
  },
  {
    "name": "Dataflow03",
    "label": "Dataflow 03",
    "category": "Development",
    "baseFamily": "Dataflow",
    "isFirstVariant": false,
    "variantCount": 4,
    "familyVariants": [
      "Dataflow01",
      "Dataflow02",
      "Dataflow03",
      "Dataflow04"
    ],
    "tags": [
      "dataflow",
      "dataflow03",
      "dataflow 03"
    ]
  },
  {
    "name": "Dataflow04",
    "label": "Dataflow 04",
    "category": "Development",
    "baseFamily": "Dataflow",
    "isFirstVariant": false,
    "variantCount": 4,
    "familyVariants": [
      "Dataflow01",
      "Dataflow02",
      "Dataflow03",
      "Dataflow04"
    ],
    "tags": [
      "dataflow",
      "dataflow04",
      "dataflow 04"
    ]
  },
  {
    "name": "Delete",
    "label": "Delete",
    "category": "General",
    "baseFamily": "Delete",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "Delete"
    ],
    "tags": [
      "delete"
    ]
  },
  {
    "name": "Diamond01",
    "label": "Diamond 01",
    "category": "Finance & eCommerce",
    "baseFamily": "Diamond",
    "isFirstVariant": true,
    "variantCount": 2,
    "familyVariants": [
      "Diamond01",
      "Diamond02"
    ],
    "tags": [
      "diamond",
      "luxury",
      "jewelry",
      "gem",
      "premium",
      "vip",
      "valuable",
      "diamond01",
      "diamond 01"
    ]
  },
  {
    "name": "Diamond02",
    "label": "Diamond 02",
    "category": "Finance & eCommerce",
    "baseFamily": "Diamond",
    "isFirstVariant": false,
    "variantCount": 2,
    "familyVariants": [
      "Diamond01",
      "Diamond02"
    ],
    "tags": [
      "diamond",
      "luxury",
      "jewelry",
      "gem",
      "premium",
      "vip",
      "diamond02",
      "diamond 02"
    ]
  },
  {
    "name": "Dice1",
    "label": "Dice 1",
    "category": "Shapes",
    "baseFamily": "Dice",
    "isFirstVariant": true,
    "variantCount": 6,
    "familyVariants": [
      "Dice1",
      "Dice2",
      "Dice3",
      "Dice4",
      "Dice5",
      "Dice6"
    ],
    "tags": [
      "dice",
      "dice1",
      "dice 1"
    ]
  },
  {
    "name": "Dice2",
    "label": "Dice 2",
    "category": "Shapes",
    "baseFamily": "Dice",
    "isFirstVariant": false,
    "variantCount": 6,
    "familyVariants": [
      "Dice1",
      "Dice2",
      "Dice3",
      "Dice4",
      "Dice5",
      "Dice6"
    ],
    "tags": [
      "dice",
      "dice2",
      "dice 2"
    ]
  },
  {
    "name": "Dice3",
    "label": "Dice 3",
    "category": "Shapes",
    "baseFamily": "Dice",
    "isFirstVariant": false,
    "variantCount": 6,
    "familyVariants": [
      "Dice1",
      "Dice2",
      "Dice3",
      "Dice4",
      "Dice5",
      "Dice6"
    ],
    "tags": [
      "dice",
      "dice3",
      "dice 3"
    ]
  },
  {
    "name": "Dice4",
    "label": "Dice 4",
    "category": "Shapes",
    "baseFamily": "Dice",
    "isFirstVariant": false,
    "variantCount": 6,
    "familyVariants": [
      "Dice1",
      "Dice2",
      "Dice3",
      "Dice4",
      "Dice5",
      "Dice6"
    ],
    "tags": [
      "dice",
      "dice4",
      "dice 4"
    ]
  },
  {
    "name": "Dice5",
    "label": "Dice 5",
    "category": "Shapes",
    "baseFamily": "Dice",
    "isFirstVariant": false,
    "variantCount": 6,
    "familyVariants": [
      "Dice1",
      "Dice2",
      "Dice3",
      "Dice4",
      "Dice5",
      "Dice6"
    ],
    "tags": [
      "dice",
      "dice5",
      "dice 5"
    ]
  },
  {
    "name": "Dice6",
    "label": "Dice 6",
    "category": "Shapes",
    "baseFamily": "Dice",
    "isFirstVariant": false,
    "variantCount": 6,
    "familyVariants": [
      "Dice1",
      "Dice2",
      "Dice3",
      "Dice4",
      "Dice5",
      "Dice6"
    ],
    "tags": [
      "dice",
      "dice6",
      "dice 6"
    ]
  },
  {
    "name": "Disc01",
    "label": "Disc 01",
    "category": "Media & devices",
    "baseFamily": "Disc",
    "isFirstVariant": true,
    "variantCount": 2,
    "familyVariants": [
      "Disc01",
      "Disc02"
    ],
    "tags": [
      "disc",
      "disc01",
      "disc 01"
    ]
  },
  {
    "name": "Disc02",
    "label": "Disc 02",
    "category": "Media & devices",
    "baseFamily": "Disc",
    "isFirstVariant": false,
    "variantCount": 2,
    "familyVariants": [
      "Disc01",
      "Disc02"
    ],
    "tags": [
      "disc",
      "disc02",
      "disc 02"
    ]
  },
  {
    "name": "DistributeSpacingHorizontal",
    "label": "Distribute Spacing Horizontal",
    "category": "Layout",
    "baseFamily": "DistributeSpacingHorizontal",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "DistributeSpacingHorizontal"
    ],
    "tags": [
      "distribute",
      "spacing",
      "horizontal",
      "distributespacinghorizontal",
      "distribute spacing horizontal"
    ]
  },
  {
    "name": "DistributeSpacingVertical",
    "label": "Distribute Spacing Vertical",
    "category": "Layout",
    "baseFamily": "DistributeSpacingVertical",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "DistributeSpacingVertical"
    ],
    "tags": [
      "distribute",
      "spacing",
      "vertical",
      "distributespacingvertical",
      "distribute spacing vertical"
    ]
  },
  {
    "name": "Divide01",
    "label": "Divide 01",
    "category": "General",
    "baseFamily": "Divide",
    "isFirstVariant": true,
    "variantCount": 3,
    "familyVariants": [
      "Divide01",
      "Divide02",
      "Divide03"
    ],
    "tags": [
      "divide",
      "divide01",
      "divide 01"
    ]
  },
  {
    "name": "Divide02",
    "label": "Divide 02",
    "category": "General",
    "baseFamily": "Divide",
    "isFirstVariant": false,
    "variantCount": 3,
    "familyVariants": [
      "Divide01",
      "Divide02",
      "Divide03"
    ],
    "tags": [
      "divide",
      "divide02",
      "divide 02"
    ]
  },
  {
    "name": "Divide03",
    "label": "Divide 03",
    "category": "General",
    "baseFamily": "Divide",
    "isFirstVariant": false,
    "variantCount": 3,
    "familyVariants": [
      "Divide01",
      "Divide02",
      "Divide03"
    ],
    "tags": [
      "divide",
      "divide03",
      "divide 03"
    ]
  },
  {
    "name": "Divider",
    "label": "Divider",
    "category": "Layout",
    "baseFamily": "Divider",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "Divider"
    ],
    "tags": [
      "divider"
    ]
  },
  {
    "name": "Dotpoints01",
    "label": "Dotpoints 01",
    "category": "General",
    "baseFamily": "Dotpoints",
    "isFirstVariant": true,
    "variantCount": 2,
    "familyVariants": [
      "Dotpoints01",
      "Dotpoints02"
    ],
    "tags": [
      "dotpoints",
      "dotpoints01",
      "dotpoints 01"
    ]
  },
  {
    "name": "Dotpoints02",
    "label": "Dotpoints 02",
    "category": "General",
    "baseFamily": "Dotpoints",
    "isFirstVariant": false,
    "variantCount": 2,
    "familyVariants": [
      "Dotpoints01",
      "Dotpoints02"
    ],
    "tags": [
      "dotpoints",
      "dotpoints02",
      "dotpoints 02"
    ]
  },
  {
    "name": "DotsGrid",
    "label": "Dots Grid",
    "category": "Layout",
    "baseFamily": "DotsGrid",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "DotsGrid"
    ],
    "tags": [
      "dots",
      "grid",
      "dotsgrid",
      "dots grid"
    ]
  },
  {
    "name": "DotsHorizontal",
    "label": "Dots Horizontal",
    "category": "Layout",
    "baseFamily": "DotsHorizontal",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "DotsHorizontal"
    ],
    "tags": [
      "dots",
      "horizontal",
      "dotshorizontal",
      "dots horizontal"
    ]
  },
  {
    "name": "DotsVertical",
    "label": "Dots Vertical",
    "category": "Layout",
    "baseFamily": "DotsVertical",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "DotsVertical"
    ],
    "tags": [
      "dots",
      "vertical",
      "dotsvertical",
      "dots vertical"
    ]
  },
  {
    "name": "Download01",
    "label": "Download 01",
    "category": "General",
    "baseFamily": "Download",
    "isFirstVariant": true,
    "variantCount": 4,
    "familyVariants": [
      "Download01",
      "Download02",
      "Download03",
      "Download04"
    ],
    "tags": [
      "download",
      "download01",
      "download 01"
    ]
  },
  {
    "name": "Download02",
    "label": "Download 02",
    "category": "General",
    "baseFamily": "Download",
    "isFirstVariant": false,
    "variantCount": 4,
    "familyVariants": [
      "Download01",
      "Download02",
      "Download03",
      "Download04"
    ],
    "tags": [
      "download",
      "download02",
      "download 02"
    ]
  },
  {
    "name": "Download03",
    "label": "Download 03",
    "category": "General",
    "baseFamily": "Download",
    "isFirstVariant": false,
    "variantCount": 4,
    "familyVariants": [
      "Download01",
      "Download02",
      "Download03",
      "Download04"
    ],
    "tags": [
      "download",
      "download03",
      "download 03"
    ]
  },
  {
    "name": "Download04",
    "label": "Download 04",
    "category": "General",
    "baseFamily": "Download",
    "isFirstVariant": false,
    "variantCount": 4,
    "familyVariants": [
      "Download01",
      "Download02",
      "Download03",
      "Download04"
    ],
    "tags": [
      "download",
      "download04",
      "download 04"
    ]
  },
  {
    "name": "DownloadCloud01",
    "label": "Download Cloud 01",
    "category": "General",
    "baseFamily": "DownloadCloud",
    "isFirstVariant": true,
    "variantCount": 2,
    "familyVariants": [
      "DownloadCloud01",
      "DownloadCloud02"
    ],
    "tags": [
      "download",
      "cloud",
      "downloadcloud01",
      "download cloud 01",
      "downloadcloud"
    ]
  },
  {
    "name": "DownloadCloud02",
    "label": "Download Cloud 02",
    "category": "General",
    "baseFamily": "DownloadCloud",
    "isFirstVariant": false,
    "variantCount": 2,
    "familyVariants": [
      "DownloadCloud01",
      "DownloadCloud02"
    ],
    "tags": [
      "download",
      "cloud",
      "downloadcloud02",
      "download cloud 02",
      "downloadcloud"
    ]
  },
  {
    "name": "Drop",
    "label": "Drop",
    "category": "Images",
    "baseFamily": "Drop",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "Drop"
    ],
    "tags": [
      "drop"
    ]
  },
  {
    "name": "Droplets01",
    "label": "Droplets 01",
    "category": "Images",
    "baseFamily": "Droplets",
    "isFirstVariant": true,
    "variantCount": 3,
    "familyVariants": [
      "Droplets01",
      "Droplets02",
      "Droplets03"
    ],
    "tags": [
      "droplets",
      "droplets01",
      "droplets 01"
    ]
  },
  {
    "name": "Droplets02",
    "label": "Droplets 02",
    "category": "Images",
    "baseFamily": "Droplets",
    "isFirstVariant": false,
    "variantCount": 3,
    "familyVariants": [
      "Droplets01",
      "Droplets02",
      "Droplets03"
    ],
    "tags": [
      "droplets",
      "droplets02",
      "droplets 02"
    ]
  },
  {
    "name": "Droplets03",
    "label": "Droplets 03",
    "category": "Images",
    "baseFamily": "Droplets",
    "isFirstVariant": false,
    "variantCount": 3,
    "familyVariants": [
      "Droplets01",
      "Droplets02",
      "Droplets03"
    ],
    "tags": [
      "droplets",
      "droplets03",
      "droplets 03"
    ]
  },
  {
    "name": "Dropper",
    "label": "Dropper",
    "category": "Images",
    "baseFamily": "Dropper",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "Dropper"
    ],
    "tags": [
      "dropper"
    ]
  },
  {
    "name": "Edit01",
    "label": "Edit 01",
    "category": "Editor",
    "baseFamily": "Edit",
    "isFirstVariant": true,
    "variantCount": 5,
    "familyVariants": [
      "Edit01",
      "Edit02",
      "Edit03",
      "Edit04",
      "Edit05"
    ],
    "tags": [
      "edit",
      "edit01",
      "edit 01"
    ]
  },
  {
    "name": "Edit02",
    "label": "Edit 02",
    "category": "Editor",
    "baseFamily": "Edit",
    "isFirstVariant": false,
    "variantCount": 5,
    "familyVariants": [
      "Edit01",
      "Edit02",
      "Edit03",
      "Edit04",
      "Edit05"
    ],
    "tags": [
      "edit",
      "edit02",
      "edit 02"
    ]
  },
  {
    "name": "Edit03",
    "label": "Edit 03",
    "category": "Editor",
    "baseFamily": "Edit",
    "isFirstVariant": false,
    "variantCount": 5,
    "familyVariants": [
      "Edit01",
      "Edit02",
      "Edit03",
      "Edit04",
      "Edit05"
    ],
    "tags": [
      "edit",
      "edit03",
      "edit 03"
    ]
  },
  {
    "name": "Edit04",
    "label": "Edit 04",
    "category": "Editor",
    "baseFamily": "Edit",
    "isFirstVariant": false,
    "variantCount": 5,
    "familyVariants": [
      "Edit01",
      "Edit02",
      "Edit03",
      "Edit04",
      "Edit05"
    ],
    "tags": [
      "edit",
      "edit04",
      "edit 04"
    ]
  },
  {
    "name": "Edit05",
    "label": "Edit 05",
    "category": "Editor",
    "baseFamily": "Edit",
    "isFirstVariant": false,
    "variantCount": 5,
    "familyVariants": [
      "Edit01",
      "Edit02",
      "Edit03",
      "Edit04",
      "Edit05"
    ],
    "tags": [
      "edit",
      "edit05",
      "edit 05"
    ]
  },
  {
    "name": "Equal",
    "label": "Equal",
    "category": "General",
    "baseFamily": "Equal",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "Equal"
    ],
    "tags": [
      "equal"
    ]
  },
  {
    "name": "EqualNot",
    "label": "Equal Not",
    "category": "General",
    "baseFamily": "EqualNot",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "EqualNot"
    ],
    "tags": [
      "equal",
      "not",
      "equalnot",
      "equal not"
    ]
  },
  {
    "name": "Eraser",
    "label": "Eraser",
    "category": "Editor",
    "baseFamily": "Eraser",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "Eraser"
    ],
    "tags": [
      "eraser"
    ]
  },
  {
    "name": "Expand01",
    "label": "Expand 01",
    "category": "Arrows",
    "baseFamily": "Expand",
    "isFirstVariant": true,
    "variantCount": 6,
    "familyVariants": [
      "Expand01",
      "Expand02",
      "Expand03",
      "Expand04",
      "Expand05",
      "Expand06"
    ],
    "tags": [
      "expand",
      "expand01",
      "expand 01"
    ]
  },
  {
    "name": "Expand02",
    "label": "Expand 02",
    "category": "Arrows",
    "baseFamily": "Expand",
    "isFirstVariant": false,
    "variantCount": 6,
    "familyVariants": [
      "Expand01",
      "Expand02",
      "Expand03",
      "Expand04",
      "Expand05",
      "Expand06"
    ],
    "tags": [
      "expand",
      "expand02",
      "expand 02"
    ]
  },
  {
    "name": "Expand03",
    "label": "Expand 03",
    "category": "Arrows",
    "baseFamily": "Expand",
    "isFirstVariant": false,
    "variantCount": 6,
    "familyVariants": [
      "Expand01",
      "Expand02",
      "Expand03",
      "Expand04",
      "Expand05",
      "Expand06"
    ],
    "tags": [
      "expand",
      "expand03",
      "expand 03"
    ]
  },
  {
    "name": "Expand04",
    "label": "Expand 04",
    "category": "Arrows",
    "baseFamily": "Expand",
    "isFirstVariant": false,
    "variantCount": 6,
    "familyVariants": [
      "Expand01",
      "Expand02",
      "Expand03",
      "Expand04",
      "Expand05",
      "Expand06"
    ],
    "tags": [
      "expand",
      "expand04",
      "expand 04"
    ]
  },
  {
    "name": "Expand05",
    "label": "Expand 05",
    "category": "Arrows",
    "baseFamily": "Expand",
    "isFirstVariant": false,
    "variantCount": 6,
    "familyVariants": [
      "Expand01",
      "Expand02",
      "Expand03",
      "Expand04",
      "Expand05",
      "Expand06"
    ],
    "tags": [
      "expand",
      "expand05",
      "expand 05"
    ]
  },
  {
    "name": "Expand06",
    "label": "Expand 06",
    "category": "Arrows",
    "baseFamily": "Expand",
    "isFirstVariant": false,
    "variantCount": 6,
    "familyVariants": [
      "Expand01",
      "Expand02",
      "Expand03",
      "Expand04",
      "Expand05",
      "Expand06"
    ],
    "tags": [
      "expand",
      "expand06",
      "expand 06"
    ]
  },
  {
    "name": "Eye",
    "label": "Eye",
    "category": "Security",
    "baseFamily": "Eye",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "Eye"
    ],
    "tags": [
      "eye"
    ]
  },
  {
    "name": "EyeOff",
    "label": "Eye Off",
    "category": "Security",
    "baseFamily": "EyeOff",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "EyeOff"
    ],
    "tags": [
      "eye",
      "off",
      "eyeoff",
      "eye off"
    ]
  },
  {
    "name": "FaceContent",
    "label": "Face Content",
    "category": "Users",
    "baseFamily": "FaceContent",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "FaceContent"
    ],
    "tags": [
      "face",
      "content",
      "facecontent",
      "face content"
    ]
  },
  {
    "name": "FaceFrown",
    "label": "Face Frown",
    "category": "Users",
    "baseFamily": "FaceFrown",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "FaceFrown"
    ],
    "tags": [
      "face",
      "frown",
      "facefrown",
      "face frown"
    ]
  },
  {
    "name": "FaceHappy",
    "label": "Face Happy",
    "category": "Users",
    "baseFamily": "FaceHappy",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "FaceHappy"
    ],
    "tags": [
      "face",
      "happy",
      "facehappy",
      "face happy"
    ]
  },
  {
    "name": "FaceId",
    "label": "Face Id",
    "category": "Users",
    "baseFamily": "FaceId",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "FaceId"
    ],
    "tags": [
      "face",
      "id",
      "faceid",
      "face id"
    ]
  },
  {
    "name": "FaceIdSquare",
    "label": "Face Id Square",
    "category": "Users",
    "baseFamily": "FaceIdSquare",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "FaceIdSquare"
    ],
    "tags": [
      "face",
      "id",
      "square",
      "faceidsquare",
      "face id square"
    ]
  },
  {
    "name": "FaceNeutral",
    "label": "Face Neutral",
    "category": "Users",
    "baseFamily": "FaceNeutral",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "FaceNeutral"
    ],
    "tags": [
      "face",
      "neutral",
      "faceneutral",
      "face neutral"
    ]
  },
  {
    "name": "FaceSad",
    "label": "Face Sad",
    "category": "Users",
    "baseFamily": "FaceSad",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "FaceSad"
    ],
    "tags": [
      "face",
      "sad",
      "facesad",
      "face sad"
    ]
  },
  {
    "name": "FaceSmile",
    "label": "Face Smile",
    "category": "Users",
    "baseFamily": "FaceSmile",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "FaceSmile"
    ],
    "tags": [
      "face",
      "smile",
      "user",
      "happy",
      "customer",
      "person",
      "avatar",
      "facesmile",
      "face smile"
    ]
  },
  {
    "name": "FaceWink",
    "label": "Face Wink",
    "category": "Users",
    "baseFamily": "FaceWink",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "FaceWink"
    ],
    "tags": [
      "face",
      "wink",
      "facewink",
      "face wink"
    ]
  },
  {
    "name": "FastBackward",
    "label": "Fast Backward",
    "category": "General",
    "baseFamily": "FastBackward",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "FastBackward"
    ],
    "tags": [
      "fast",
      "backward",
      "fastbackward",
      "fast backward"
    ]
  },
  {
    "name": "FastForward",
    "label": "Fast Forward",
    "category": "General",
    "baseFamily": "FastForward",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "FastForward"
    ],
    "tags": [
      "fast",
      "forward",
      "fastforward",
      "fast forward"
    ]
  },
  {
    "name": "Feather",
    "label": "Feather",
    "category": "General",
    "baseFamily": "Feather",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "Feather"
    ],
    "tags": [
      "feather"
    ]
  },
  {
    "name": "Figma",
    "label": "Figma",
    "category": "General",
    "baseFamily": "Figma",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "Figma"
    ],
    "tags": [
      "figma"
    ]
  },
  {
    "name": "File01",
    "label": "File 01",
    "category": "Files",
    "baseFamily": "File",
    "isFirstVariant": true,
    "variantCount": 7,
    "familyVariants": [
      "File01",
      "File02",
      "File03",
      "File04",
      "File05",
      "File06",
      "File07"
    ],
    "tags": [
      "file",
      "file01",
      "file 01"
    ]
  },
  {
    "name": "File02",
    "label": "File 02",
    "category": "Files",
    "baseFamily": "File",
    "isFirstVariant": false,
    "variantCount": 7,
    "familyVariants": [
      "File01",
      "File02",
      "File03",
      "File04",
      "File05",
      "File06",
      "File07"
    ],
    "tags": [
      "file",
      "file02",
      "file 02"
    ]
  },
  {
    "name": "File03",
    "label": "File 03",
    "category": "Files",
    "baseFamily": "File",
    "isFirstVariant": false,
    "variantCount": 7,
    "familyVariants": [
      "File01",
      "File02",
      "File03",
      "File04",
      "File05",
      "File06",
      "File07"
    ],
    "tags": [
      "file",
      "file03",
      "file 03"
    ]
  },
  {
    "name": "File04",
    "label": "File 04",
    "category": "Files",
    "baseFamily": "File",
    "isFirstVariant": false,
    "variantCount": 7,
    "familyVariants": [
      "File01",
      "File02",
      "File03",
      "File04",
      "File05",
      "File06",
      "File07"
    ],
    "tags": [
      "file",
      "file04",
      "file 04"
    ]
  },
  {
    "name": "File05",
    "label": "File 05",
    "category": "Files",
    "baseFamily": "File",
    "isFirstVariant": false,
    "variantCount": 7,
    "familyVariants": [
      "File01",
      "File02",
      "File03",
      "File04",
      "File05",
      "File06",
      "File07"
    ],
    "tags": [
      "file",
      "file05",
      "file 05"
    ]
  },
  {
    "name": "File06",
    "label": "File 06",
    "category": "Files",
    "baseFamily": "File",
    "isFirstVariant": false,
    "variantCount": 7,
    "familyVariants": [
      "File01",
      "File02",
      "File03",
      "File04",
      "File05",
      "File06",
      "File07"
    ],
    "tags": [
      "file",
      "file06",
      "file 06"
    ]
  },
  {
    "name": "File07",
    "label": "File 07",
    "category": "Files",
    "baseFamily": "File",
    "isFirstVariant": false,
    "variantCount": 7,
    "familyVariants": [
      "File01",
      "File02",
      "File03",
      "File04",
      "File05",
      "File06",
      "File07"
    ],
    "tags": [
      "file",
      "file07",
      "file 07"
    ]
  },
  {
    "name": "FileAttachment01",
    "label": "File Attachment 01",
    "category": "Files",
    "baseFamily": "FileAttachment",
    "isFirstVariant": true,
    "variantCount": 5,
    "familyVariants": [
      "FileAttachment01",
      "FileAttachment02",
      "FileAttachment03",
      "FileAttachment04",
      "FileAttachment05"
    ],
    "tags": [
      "file",
      "attachment",
      "fileattachment01",
      "file attachment 01",
      "fileattachment"
    ]
  },
  {
    "name": "FileAttachment02",
    "label": "File Attachment 02",
    "category": "Files",
    "baseFamily": "FileAttachment",
    "isFirstVariant": false,
    "variantCount": 5,
    "familyVariants": [
      "FileAttachment01",
      "FileAttachment02",
      "FileAttachment03",
      "FileAttachment04",
      "FileAttachment05"
    ],
    "tags": [
      "file",
      "attachment",
      "fileattachment02",
      "file attachment 02",
      "fileattachment"
    ]
  },
  {
    "name": "FileAttachment03",
    "label": "File Attachment 03",
    "category": "Files",
    "baseFamily": "FileAttachment",
    "isFirstVariant": false,
    "variantCount": 5,
    "familyVariants": [
      "FileAttachment01",
      "FileAttachment02",
      "FileAttachment03",
      "FileAttachment04",
      "FileAttachment05"
    ],
    "tags": [
      "file",
      "attachment",
      "fileattachment03",
      "file attachment 03",
      "fileattachment"
    ]
  },
  {
    "name": "FileAttachment04",
    "label": "File Attachment 04",
    "category": "Files",
    "baseFamily": "FileAttachment",
    "isFirstVariant": false,
    "variantCount": 5,
    "familyVariants": [
      "FileAttachment01",
      "FileAttachment02",
      "FileAttachment03",
      "FileAttachment04",
      "FileAttachment05"
    ],
    "tags": [
      "file",
      "attachment",
      "fileattachment04",
      "file attachment 04",
      "fileattachment"
    ]
  },
  {
    "name": "FileAttachment05",
    "label": "File Attachment 05",
    "category": "Files",
    "baseFamily": "FileAttachment",
    "isFirstVariant": false,
    "variantCount": 5,
    "familyVariants": [
      "FileAttachment01",
      "FileAttachment02",
      "FileAttachment03",
      "FileAttachment04",
      "FileAttachment05"
    ],
    "tags": [
      "file",
      "attachment",
      "fileattachment05",
      "file attachment 05",
      "fileattachment"
    ]
  },
  {
    "name": "FileCheck01",
    "label": "File Check 01",
    "category": "Files",
    "baseFamily": "FileCheck",
    "isFirstVariant": true,
    "variantCount": 3,
    "familyVariants": [
      "FileCheck01",
      "FileCheck02",
      "FileCheck03"
    ],
    "tags": [
      "file",
      "check",
      "filecheck01",
      "file check 01",
      "filecheck"
    ]
  },
  {
    "name": "FileCheck02",
    "label": "File Check 02",
    "category": "Files",
    "baseFamily": "FileCheck",
    "isFirstVariant": false,
    "variantCount": 3,
    "familyVariants": [
      "FileCheck01",
      "FileCheck02",
      "FileCheck03"
    ],
    "tags": [
      "file",
      "check",
      "filecheck02",
      "file check 02",
      "filecheck"
    ]
  },
  {
    "name": "FileCheck03",
    "label": "File Check 03",
    "category": "Files",
    "baseFamily": "FileCheck",
    "isFirstVariant": false,
    "variantCount": 3,
    "familyVariants": [
      "FileCheck01",
      "FileCheck02",
      "FileCheck03"
    ],
    "tags": [
      "file",
      "check",
      "filecheck03",
      "file check 03",
      "filecheck"
    ]
  },
  {
    "name": "FileCode01",
    "label": "File Code 01",
    "category": "Files",
    "baseFamily": "FileCode",
    "isFirstVariant": true,
    "variantCount": 2,
    "familyVariants": [
      "FileCode01",
      "FileCode02"
    ],
    "tags": [
      "file",
      "code",
      "filecode01",
      "file code 01",
      "filecode"
    ]
  },
  {
    "name": "FileCode02",
    "label": "File Code 02",
    "category": "Files",
    "baseFamily": "FileCode",
    "isFirstVariant": false,
    "variantCount": 2,
    "familyVariants": [
      "FileCode01",
      "FileCode02"
    ],
    "tags": [
      "file",
      "code",
      "filecode02",
      "file code 02",
      "filecode"
    ]
  },
  {
    "name": "FileDownload01",
    "label": "File Download 01",
    "category": "Files",
    "baseFamily": "FileDownload",
    "isFirstVariant": true,
    "variantCount": 3,
    "familyVariants": [
      "FileDownload01",
      "FileDownload02",
      "FileDownload03"
    ],
    "tags": [
      "file",
      "download",
      "filedownload01",
      "file download 01",
      "filedownload"
    ]
  },
  {
    "name": "FileDownload02",
    "label": "File Download 02",
    "category": "Files",
    "baseFamily": "FileDownload",
    "isFirstVariant": false,
    "variantCount": 3,
    "familyVariants": [
      "FileDownload01",
      "FileDownload02",
      "FileDownload03"
    ],
    "tags": [
      "file",
      "download",
      "filedownload02",
      "file download 02",
      "filedownload"
    ]
  },
  {
    "name": "FileDownload03",
    "label": "File Download 03",
    "category": "Files",
    "baseFamily": "FileDownload",
    "isFirstVariant": false,
    "variantCount": 3,
    "familyVariants": [
      "FileDownload01",
      "FileDownload02",
      "FileDownload03"
    ],
    "tags": [
      "file",
      "download",
      "filedownload03",
      "file download 03",
      "filedownload"
    ]
  },
  {
    "name": "FileHeart01",
    "label": "File Heart 01",
    "category": "Files",
    "baseFamily": "FileHeart",
    "isFirstVariant": true,
    "variantCount": 3,
    "familyVariants": [
      "FileHeart01",
      "FileHeart02",
      "FileHeart03"
    ],
    "tags": [
      "file",
      "heart",
      "fileheart01",
      "file heart 01",
      "fileheart"
    ]
  },
  {
    "name": "FileHeart02",
    "label": "File Heart 02",
    "category": "Files",
    "baseFamily": "FileHeart",
    "isFirstVariant": false,
    "variantCount": 3,
    "familyVariants": [
      "FileHeart01",
      "FileHeart02",
      "FileHeart03"
    ],
    "tags": [
      "file",
      "heart",
      "fileheart02",
      "file heart 02",
      "fileheart"
    ]
  },
  {
    "name": "FileHeart03",
    "label": "File Heart 03",
    "category": "Files",
    "baseFamily": "FileHeart",
    "isFirstVariant": false,
    "variantCount": 3,
    "familyVariants": [
      "FileHeart01",
      "FileHeart02",
      "FileHeart03"
    ],
    "tags": [
      "file",
      "heart",
      "fileheart03",
      "file heart 03",
      "fileheart"
    ]
  },
  {
    "name": "FileLock01",
    "label": "File Lock 01",
    "category": "Security",
    "baseFamily": "FileLock",
    "isFirstVariant": true,
    "variantCount": 3,
    "familyVariants": [
      "FileLock01",
      "FileLock02",
      "FileLock03"
    ],
    "tags": [
      "file",
      "lock",
      "filelock01",
      "file lock 01",
      "filelock"
    ]
  },
  {
    "name": "FileLock02",
    "label": "File Lock 02",
    "category": "Security",
    "baseFamily": "FileLock",
    "isFirstVariant": false,
    "variantCount": 3,
    "familyVariants": [
      "FileLock01",
      "FileLock02",
      "FileLock03"
    ],
    "tags": [
      "file",
      "lock",
      "filelock02",
      "file lock 02",
      "filelock"
    ]
  },
  {
    "name": "FileLock03",
    "label": "File Lock 03",
    "category": "Security",
    "baseFamily": "FileLock",
    "isFirstVariant": false,
    "variantCount": 3,
    "familyVariants": [
      "FileLock01",
      "FileLock02",
      "FileLock03"
    ],
    "tags": [
      "file",
      "lock",
      "filelock03",
      "file lock 03",
      "filelock"
    ]
  },
  {
    "name": "FileMinus01",
    "label": "File Minus 01",
    "category": "Files",
    "baseFamily": "FileMinus",
    "isFirstVariant": true,
    "variantCount": 3,
    "familyVariants": [
      "FileMinus01",
      "FileMinus02",
      "FileMinus03"
    ],
    "tags": [
      "file",
      "minus",
      "fileminus01",
      "file minus 01",
      "fileminus"
    ]
  },
  {
    "name": "FileMinus02",
    "label": "File Minus 02",
    "category": "Files",
    "baseFamily": "FileMinus",
    "isFirstVariant": false,
    "variantCount": 3,
    "familyVariants": [
      "FileMinus01",
      "FileMinus02",
      "FileMinus03"
    ],
    "tags": [
      "file",
      "minus",
      "fileminus02",
      "file minus 02",
      "fileminus"
    ]
  },
  {
    "name": "FileMinus03",
    "label": "File Minus 03",
    "category": "Files",
    "baseFamily": "FileMinus",
    "isFirstVariant": false,
    "variantCount": 3,
    "familyVariants": [
      "FileMinus01",
      "FileMinus02",
      "FileMinus03"
    ],
    "tags": [
      "file",
      "minus",
      "fileminus03",
      "file minus 03",
      "fileminus"
    ]
  },
  {
    "name": "FilePlus01",
    "label": "File Plus 01",
    "category": "Files",
    "baseFamily": "FilePlus",
    "isFirstVariant": true,
    "variantCount": 3,
    "familyVariants": [
      "FilePlus01",
      "FilePlus02",
      "FilePlus03"
    ],
    "tags": [
      "file",
      "plus",
      "fileplus01",
      "file plus 01",
      "fileplus"
    ]
  },
  {
    "name": "FilePlus02",
    "label": "File Plus 02",
    "category": "Files",
    "baseFamily": "FilePlus",
    "isFirstVariant": false,
    "variantCount": 3,
    "familyVariants": [
      "FilePlus01",
      "FilePlus02",
      "FilePlus03"
    ],
    "tags": [
      "file",
      "plus",
      "fileplus02",
      "file plus 02",
      "fileplus"
    ]
  },
  {
    "name": "FilePlus03",
    "label": "File Plus 03",
    "category": "Files",
    "baseFamily": "FilePlus",
    "isFirstVariant": false,
    "variantCount": 3,
    "familyVariants": [
      "FilePlus01",
      "FilePlus02",
      "FilePlus03"
    ],
    "tags": [
      "file",
      "plus",
      "fileplus03",
      "file plus 03",
      "fileplus"
    ]
  },
  {
    "name": "FileQuestion01",
    "label": "File Question 01",
    "category": "Files",
    "baseFamily": "FileQuestion",
    "isFirstVariant": true,
    "variantCount": 3,
    "familyVariants": [
      "FileQuestion01",
      "FileQuestion02",
      "FileQuestion03"
    ],
    "tags": [
      "file",
      "question",
      "filequestion01",
      "file question 01",
      "filequestion"
    ]
  },
  {
    "name": "FileQuestion02",
    "label": "File Question 02",
    "category": "Files",
    "baseFamily": "FileQuestion",
    "isFirstVariant": false,
    "variantCount": 3,
    "familyVariants": [
      "FileQuestion01",
      "FileQuestion02",
      "FileQuestion03"
    ],
    "tags": [
      "file",
      "question",
      "filequestion02",
      "file question 02",
      "filequestion"
    ]
  },
  {
    "name": "FileQuestion03",
    "label": "File Question 03",
    "category": "Files",
    "baseFamily": "FileQuestion",
    "isFirstVariant": false,
    "variantCount": 3,
    "familyVariants": [
      "FileQuestion01",
      "FileQuestion02",
      "FileQuestion03"
    ],
    "tags": [
      "file",
      "question",
      "filequestion03",
      "file question 03",
      "filequestion"
    ]
  },
  {
    "name": "FileSearch01",
    "label": "File Search 01",
    "category": "Files",
    "baseFamily": "FileSearch",
    "isFirstVariant": true,
    "variantCount": 3,
    "familyVariants": [
      "FileSearch01",
      "FileSearch02",
      "FileSearch03"
    ],
    "tags": [
      "file",
      "search",
      "filesearch01",
      "file search 01",
      "filesearch"
    ]
  },
  {
    "name": "FileSearch02",
    "label": "File Search 02",
    "category": "Files",
    "baseFamily": "FileSearch",
    "isFirstVariant": false,
    "variantCount": 3,
    "familyVariants": [
      "FileSearch01",
      "FileSearch02",
      "FileSearch03"
    ],
    "tags": [
      "file",
      "search",
      "filesearch02",
      "file search 02",
      "filesearch"
    ]
  },
  {
    "name": "FileSearch03",
    "label": "File Search 03",
    "category": "Files",
    "baseFamily": "FileSearch",
    "isFirstVariant": false,
    "variantCount": 3,
    "familyVariants": [
      "FileSearch01",
      "FileSearch02",
      "FileSearch03"
    ],
    "tags": [
      "file",
      "search",
      "filesearch03",
      "file search 03",
      "filesearch"
    ]
  },
  {
    "name": "FileShield01",
    "label": "File Shield 01",
    "category": "Files",
    "baseFamily": "FileShield",
    "isFirstVariant": true,
    "variantCount": 3,
    "familyVariants": [
      "FileShield01",
      "FileShield02",
      "FileShield03"
    ],
    "tags": [
      "file",
      "shield",
      "fileshield01",
      "file shield 01",
      "fileshield"
    ]
  },
  {
    "name": "FileShield02",
    "label": "File Shield 02",
    "category": "Files",
    "baseFamily": "FileShield",
    "isFirstVariant": false,
    "variantCount": 3,
    "familyVariants": [
      "FileShield01",
      "FileShield02",
      "FileShield03"
    ],
    "tags": [
      "file",
      "shield",
      "fileshield02",
      "file shield 02",
      "fileshield"
    ]
  },
  {
    "name": "FileShield03",
    "label": "File Shield 03",
    "category": "Files",
    "baseFamily": "FileShield",
    "isFirstVariant": false,
    "variantCount": 3,
    "familyVariants": [
      "FileShield01",
      "FileShield02",
      "FileShield03"
    ],
    "tags": [
      "file",
      "shield",
      "fileshield03",
      "file shield 03",
      "fileshield"
    ]
  },
  {
    "name": "FileX01",
    "label": "File X 01",
    "category": "Files",
    "baseFamily": "FileX",
    "isFirstVariant": true,
    "variantCount": 3,
    "familyVariants": [
      "FileX01",
      "FileX02",
      "FileX03"
    ],
    "tags": [
      "file",
      "x",
      "filex01",
      "file x 01",
      "filex"
    ]
  },
  {
    "name": "FileX02",
    "label": "File X 02",
    "category": "Files",
    "baseFamily": "FileX",
    "isFirstVariant": false,
    "variantCount": 3,
    "familyVariants": [
      "FileX01",
      "FileX02",
      "FileX03"
    ],
    "tags": [
      "file",
      "x",
      "filex02",
      "file x 02",
      "filex"
    ]
  },
  {
    "name": "FileX03",
    "label": "File X 03",
    "category": "Files",
    "baseFamily": "FileX",
    "isFirstVariant": false,
    "variantCount": 3,
    "familyVariants": [
      "FileX01",
      "FileX02",
      "FileX03"
    ],
    "tags": [
      "file",
      "x",
      "filex03",
      "file x 03",
      "filex"
    ]
  },
  {
    "name": "Film01",
    "label": "Film 01",
    "category": "Media & devices",
    "baseFamily": "Film",
    "isFirstVariant": true,
    "variantCount": 3,
    "familyVariants": [
      "Film01",
      "Film02",
      "Film03"
    ],
    "tags": [
      "film",
      "movie",
      "cinema",
      "theatre",
      "netflix",
      "streaming",
      "entertainment",
      "video",
      "show",
      "film01",
      "film 01"
    ]
  },
  {
    "name": "Film02",
    "label": "Film 02",
    "category": "Media & devices",
    "baseFamily": "Film",
    "isFirstVariant": false,
    "variantCount": 3,
    "familyVariants": [
      "Film01",
      "Film02",
      "Film03"
    ],
    "tags": [
      "film",
      "movie",
      "cinema",
      "theatre",
      "netflix",
      "streaming",
      "entertainment",
      "film02",
      "film 02"
    ]
  },
  {
    "name": "Film03",
    "label": "Film 03",
    "category": "Media & devices",
    "baseFamily": "Film",
    "isFirstVariant": false,
    "variantCount": 3,
    "familyVariants": [
      "Film01",
      "Film02",
      "Film03"
    ],
    "tags": [
      "film",
      "film03",
      "film 03"
    ]
  },
  {
    "name": "FilterFunnel01",
    "label": "Filter Funnel 01",
    "category": "Images",
    "baseFamily": "FilterFunnel",
    "isFirstVariant": true,
    "variantCount": 2,
    "familyVariants": [
      "FilterFunnel01",
      "FilterFunnel02"
    ],
    "tags": [
      "filter",
      "funnel",
      "filterfunnel01",
      "filter funnel 01",
      "filterfunnel"
    ]
  },
  {
    "name": "FilterFunnel02",
    "label": "Filter Funnel 02",
    "category": "Images",
    "baseFamily": "FilterFunnel",
    "isFirstVariant": false,
    "variantCount": 2,
    "familyVariants": [
      "FilterFunnel01",
      "FilterFunnel02"
    ],
    "tags": [
      "filter",
      "funnel",
      "filterfunnel02",
      "filter funnel 02",
      "filterfunnel"
    ]
  },
  {
    "name": "FilterLines",
    "label": "Filter Lines",
    "category": "Images",
    "baseFamily": "FilterLines",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "FilterLines"
    ],
    "tags": [
      "filter",
      "lines",
      "filterlines",
      "filter lines"
    ]
  },
  {
    "name": "Fingerprint01",
    "label": "Fingerprint 01",
    "category": "Security",
    "baseFamily": "Fingerprint",
    "isFirstVariant": true,
    "variantCount": 4,
    "familyVariants": [
      "Fingerprint01",
      "Fingerprint02",
      "Fingerprint03",
      "Fingerprint04"
    ],
    "tags": [
      "fingerprint",
      "biometrics",
      "touch id",
      "security",
      "identity",
      "auth",
      "fingerprint01",
      "fingerprint 01"
    ]
  },
  {
    "name": "Fingerprint02",
    "label": "Fingerprint 02",
    "category": "Security",
    "baseFamily": "Fingerprint",
    "isFirstVariant": false,
    "variantCount": 4,
    "familyVariants": [
      "Fingerprint01",
      "Fingerprint02",
      "Fingerprint03",
      "Fingerprint04"
    ],
    "tags": [
      "fingerprint",
      "biometrics",
      "touch id",
      "security",
      "identity",
      "auth",
      "fingerprint02",
      "fingerprint 02"
    ]
  },
  {
    "name": "Fingerprint03",
    "label": "Fingerprint 03",
    "category": "Security",
    "baseFamily": "Fingerprint",
    "isFirstVariant": false,
    "variantCount": 4,
    "familyVariants": [
      "Fingerprint01",
      "Fingerprint02",
      "Fingerprint03",
      "Fingerprint04"
    ],
    "tags": [
      "fingerprint",
      "fingerprint03",
      "fingerprint 03"
    ]
  },
  {
    "name": "Fingerprint04",
    "label": "Fingerprint 04",
    "category": "Security",
    "baseFamily": "Fingerprint",
    "isFirstVariant": false,
    "variantCount": 4,
    "familyVariants": [
      "Fingerprint01",
      "Fingerprint02",
      "Fingerprint03",
      "Fingerprint04"
    ],
    "tags": [
      "fingerprint",
      "fingerprint04",
      "fingerprint 04"
    ]
  },
  {
    "name": "Flag01",
    "label": "Flag 01",
    "category": "Maps & travel",
    "baseFamily": "Flag",
    "isFirstVariant": true,
    "variantCount": 6,
    "familyVariants": [
      "Flag01",
      "Flag02",
      "Flag03",
      "Flag04",
      "Flag05",
      "Flag06"
    ],
    "tags": [
      "flag",
      "flag01",
      "flag 01"
    ]
  },
  {
    "name": "Flag02",
    "label": "Flag 02",
    "category": "Maps & travel",
    "baseFamily": "Flag",
    "isFirstVariant": false,
    "variantCount": 6,
    "familyVariants": [
      "Flag01",
      "Flag02",
      "Flag03",
      "Flag04",
      "Flag05",
      "Flag06"
    ],
    "tags": [
      "flag",
      "flag02",
      "flag 02"
    ]
  },
  {
    "name": "Flag03",
    "label": "Flag 03",
    "category": "Maps & travel",
    "baseFamily": "Flag",
    "isFirstVariant": false,
    "variantCount": 6,
    "familyVariants": [
      "Flag01",
      "Flag02",
      "Flag03",
      "Flag04",
      "Flag05",
      "Flag06"
    ],
    "tags": [
      "flag",
      "flag03",
      "flag 03"
    ]
  },
  {
    "name": "Flag04",
    "label": "Flag 04",
    "category": "Maps & travel",
    "baseFamily": "Flag",
    "isFirstVariant": false,
    "variantCount": 6,
    "familyVariants": [
      "Flag01",
      "Flag02",
      "Flag03",
      "Flag04",
      "Flag05",
      "Flag06"
    ],
    "tags": [
      "flag",
      "flag04",
      "flag 04"
    ]
  },
  {
    "name": "Flag05",
    "label": "Flag 05",
    "category": "Maps & travel",
    "baseFamily": "Flag",
    "isFirstVariant": false,
    "variantCount": 6,
    "familyVariants": [
      "Flag01",
      "Flag02",
      "Flag03",
      "Flag04",
      "Flag05",
      "Flag06"
    ],
    "tags": [
      "flag",
      "flag05",
      "flag 05"
    ]
  },
  {
    "name": "Flag06",
    "label": "Flag 06",
    "category": "Maps & travel",
    "baseFamily": "Flag",
    "isFirstVariant": false,
    "variantCount": 6,
    "familyVariants": [
      "Flag01",
      "Flag02",
      "Flag03",
      "Flag04",
      "Flag05",
      "Flag06"
    ],
    "tags": [
      "flag",
      "flag06",
      "flag 06"
    ]
  },
  {
    "name": "Flash",
    "label": "Flash",
    "category": "Images",
    "baseFamily": "Flash",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "Flash"
    ],
    "tags": [
      "flash"
    ]
  },
  {
    "name": "FlashOff",
    "label": "Flash Off",
    "category": "Images",
    "baseFamily": "FlashOff",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "FlashOff"
    ],
    "tags": [
      "flash",
      "off",
      "flashoff",
      "flash off"
    ]
  },
  {
    "name": "FlexAlignBottom",
    "label": "Flex Align Bottom",
    "category": "Layout",
    "baseFamily": "FlexAlignBottom",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "FlexAlignBottom"
    ],
    "tags": [
      "flex",
      "align",
      "bottom",
      "flexalignbottom",
      "flex align bottom"
    ]
  },
  {
    "name": "FlexAlignLeft",
    "label": "Flex Align Left",
    "category": "Layout",
    "baseFamily": "FlexAlignLeft",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "FlexAlignLeft"
    ],
    "tags": [
      "flex",
      "align",
      "left",
      "flexalignleft",
      "flex align left"
    ]
  },
  {
    "name": "FlexAlignRight",
    "label": "Flex Align Right",
    "category": "Layout",
    "baseFamily": "FlexAlignRight",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "FlexAlignRight"
    ],
    "tags": [
      "flex",
      "align",
      "right",
      "flexalignright",
      "flex align right"
    ]
  },
  {
    "name": "FlexAlignTop",
    "label": "Flex Align Top",
    "category": "Layout",
    "baseFamily": "FlexAlignTop",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "FlexAlignTop"
    ],
    "tags": [
      "flex",
      "align",
      "top",
      "flexaligntop",
      "flex align top"
    ]
  },
  {
    "name": "FlipBackward",
    "label": "Flip Backward",
    "category": "Arrows",
    "baseFamily": "FlipBackward",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "FlipBackward"
    ],
    "tags": [
      "flip",
      "backward",
      "flipbackward",
      "flip backward"
    ]
  },
  {
    "name": "FlipForward",
    "label": "Flip Forward",
    "category": "Arrows",
    "baseFamily": "FlipForward",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "FlipForward"
    ],
    "tags": [
      "flip",
      "forward",
      "flipforward",
      "flip forward"
    ]
  },
  {
    "name": "Folder",
    "label": "Folder",
    "category": "Files",
    "baseFamily": "Folder",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "Folder"
    ],
    "tags": [
      "folder"
    ]
  },
  {
    "name": "FolderCheck",
    "label": "Folder Check",
    "category": "Files",
    "baseFamily": "FolderCheck",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "FolderCheck"
    ],
    "tags": [
      "folder",
      "check",
      "foldercheck",
      "folder check"
    ]
  },
  {
    "name": "FolderClosed",
    "label": "Folder Closed",
    "category": "Files",
    "baseFamily": "FolderClosed",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "FolderClosed"
    ],
    "tags": [
      "folder",
      "closed",
      "folderclosed",
      "folder closed"
    ]
  },
  {
    "name": "FolderCode",
    "label": "Folder Code",
    "category": "Files",
    "baseFamily": "FolderCode",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "FolderCode"
    ],
    "tags": [
      "folder",
      "code",
      "foldercode",
      "folder code"
    ]
  },
  {
    "name": "FolderDownload",
    "label": "Folder Download",
    "category": "Files",
    "baseFamily": "FolderDownload",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "FolderDownload"
    ],
    "tags": [
      "folder",
      "download",
      "folderdownload",
      "folder download"
    ]
  },
  {
    "name": "FolderLock",
    "label": "Folder Lock",
    "category": "Security",
    "baseFamily": "FolderLock",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "FolderLock"
    ],
    "tags": [
      "folder",
      "lock",
      "folderlock",
      "folder lock"
    ]
  },
  {
    "name": "FolderMinus",
    "label": "Folder Minus",
    "category": "Files",
    "baseFamily": "FolderMinus",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "FolderMinus"
    ],
    "tags": [
      "folder",
      "minus",
      "folderminus",
      "folder minus"
    ]
  },
  {
    "name": "FolderPlus",
    "label": "Folder Plus",
    "category": "Files",
    "baseFamily": "FolderPlus",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "FolderPlus"
    ],
    "tags": [
      "folder",
      "plus",
      "folderplus",
      "folder plus"
    ]
  },
  {
    "name": "FolderQuestion",
    "label": "Folder Question",
    "category": "Files",
    "baseFamily": "FolderQuestion",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "FolderQuestion"
    ],
    "tags": [
      "folder",
      "question",
      "folderquestion",
      "folder question"
    ]
  },
  {
    "name": "FolderSearch",
    "label": "Folder Search",
    "category": "Files",
    "baseFamily": "FolderSearch",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "FolderSearch"
    ],
    "tags": [
      "folder",
      "search",
      "foldersearch",
      "folder search"
    ]
  },
  {
    "name": "FolderShield",
    "label": "Folder Shield",
    "category": "Files",
    "baseFamily": "FolderShield",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "FolderShield"
    ],
    "tags": [
      "folder",
      "shield",
      "foldershield",
      "folder shield"
    ]
  },
  {
    "name": "FolderX",
    "label": "Folder X",
    "category": "Files",
    "baseFamily": "FolderX",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "FolderX"
    ],
    "tags": [
      "folder",
      "x",
      "folderx",
      "folder x"
    ]
  },
  {
    "name": "Framer",
    "label": "Framer",
    "category": "General",
    "baseFamily": "Framer",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "Framer"
    ],
    "tags": [
      "framer"
    ]
  },
  {
    "name": "GamingPad01",
    "label": "Gaming Pad 01",
    "category": "Media & devices",
    "baseFamily": "GamingPad",
    "isFirstVariant": true,
    "variantCount": 2,
    "familyVariants": [
      "GamingPad01",
      "GamingPad02"
    ],
    "tags": [
      "gaming",
      "pad",
      "games",
      "entertainment",
      "playstation",
      "xbox",
      "nintendo",
      "arcade",
      "gamingpad01",
      "gaming pad 01",
      "gamingpad"
    ]
  },
  {
    "name": "GamingPad02",
    "label": "Gaming Pad 02",
    "category": "Media & devices",
    "baseFamily": "GamingPad",
    "isFirstVariant": false,
    "variantCount": 2,
    "familyVariants": [
      "GamingPad01",
      "GamingPad02"
    ],
    "tags": [
      "gaming",
      "pad",
      "games",
      "entertainment",
      "joystick",
      "controller",
      "gamingpad02",
      "gaming pad 02",
      "gamingpad"
    ]
  },
  {
    "name": "Gift01",
    "label": "Gift 01",
    "category": "Finance & eCommerce",
    "baseFamily": "Gift",
    "isFirstVariant": true,
    "variantCount": 2,
    "familyVariants": [
      "Gift01",
      "Gift02"
    ],
    "tags": [
      "gift",
      "present",
      "birthday",
      "reward",
      "bonus",
      "holiday",
      "celebration",
      "perk",
      "gift01",
      "gift 01"
    ]
  },
  {
    "name": "Gift02",
    "label": "Gift 02",
    "category": "Finance & eCommerce",
    "baseFamily": "Gift",
    "isFirstVariant": false,
    "variantCount": 2,
    "familyVariants": [
      "Gift01",
      "Gift02"
    ],
    "tags": [
      "gift",
      "present",
      "birthday",
      "reward",
      "bonus",
      "holiday",
      "celebration",
      "perk",
      "gift02",
      "gift 02"
    ]
  },
  {
    "name": "GitBranch01",
    "label": "Git Branch 01",
    "category": "Development",
    "baseFamily": "GitBranch",
    "isFirstVariant": true,
    "variantCount": 2,
    "familyVariants": [
      "GitBranch01",
      "GitBranch02"
    ],
    "tags": [
      "git",
      "branch",
      "gitbranch01",
      "git branch 01",
      "gitbranch"
    ]
  },
  {
    "name": "GitBranch02",
    "label": "Git Branch 02",
    "category": "Development",
    "baseFamily": "GitBranch",
    "isFirstVariant": false,
    "variantCount": 2,
    "familyVariants": [
      "GitBranch01",
      "GitBranch02"
    ],
    "tags": [
      "git",
      "branch",
      "gitbranch02",
      "git branch 02",
      "gitbranch"
    ]
  },
  {
    "name": "GitCommit",
    "label": "Git Commit",
    "category": "Development",
    "baseFamily": "GitCommit",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "GitCommit"
    ],
    "tags": [
      "git",
      "commit",
      "gitcommit",
      "git commit"
    ]
  },
  {
    "name": "GitMerge",
    "label": "Git Merge",
    "category": "Development",
    "baseFamily": "GitMerge",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "GitMerge"
    ],
    "tags": [
      "git",
      "merge",
      "gitmerge",
      "git merge"
    ]
  },
  {
    "name": "GitPullRequest",
    "label": "Git Pull Request",
    "category": "Development",
    "baseFamily": "GitPullRequest",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "GitPullRequest"
    ],
    "tags": [
      "git",
      "pull",
      "request",
      "gitpullrequest",
      "git pull request"
    ]
  },
  {
    "name": "Glasses01",
    "label": "Glasses 01",
    "category": "Users",
    "baseFamily": "Glasses",
    "isFirstVariant": true,
    "variantCount": 2,
    "familyVariants": [
      "Glasses01",
      "Glasses02"
    ],
    "tags": [
      "glasses",
      "glasses01",
      "glasses 01"
    ]
  },
  {
    "name": "Glasses02",
    "label": "Glasses 02",
    "category": "Users",
    "baseFamily": "Glasses",
    "isFirstVariant": false,
    "variantCount": 2,
    "familyVariants": [
      "Glasses01",
      "Glasses02"
    ],
    "tags": [
      "glasses",
      "glasses02",
      "glasses 02"
    ]
  },
  {
    "name": "Globe01",
    "label": "Globe 01",
    "category": "Maps & travel",
    "baseFamily": "Globe",
    "isFirstVariant": true,
    "variantCount": 6,
    "familyVariants": [
      "Globe01",
      "Globe02",
      "Globe03",
      "Globe04",
      "Globe05",
      "Globe06"
    ],
    "tags": [
      "globe",
      "world",
      "international",
      "global",
      "fx",
      "foreign currency",
      "worldwide",
      "globe01",
      "globe 01"
    ]
  },
  {
    "name": "Globe02",
    "label": "Globe 02",
    "category": "Maps & travel",
    "baseFamily": "Globe",
    "isFirstVariant": false,
    "variantCount": 6,
    "familyVariants": [
      "Globe01",
      "Globe02",
      "Globe03",
      "Globe04",
      "Globe05",
      "Globe06"
    ],
    "tags": [
      "globe",
      "world",
      "international",
      "global",
      "fx",
      "foreign currency",
      "globe02",
      "globe 02"
    ]
  },
  {
    "name": "Globe03",
    "label": "Globe 03",
    "category": "Maps & travel",
    "baseFamily": "Globe",
    "isFirstVariant": false,
    "variantCount": 6,
    "familyVariants": [
      "Globe01",
      "Globe02",
      "Globe03",
      "Globe04",
      "Globe05",
      "Globe06"
    ],
    "tags": [
      "globe",
      "globe03",
      "globe 03"
    ]
  },
  {
    "name": "Globe04",
    "label": "Globe 04",
    "category": "Maps & travel",
    "baseFamily": "Globe",
    "isFirstVariant": false,
    "variantCount": 6,
    "familyVariants": [
      "Globe01",
      "Globe02",
      "Globe03",
      "Globe04",
      "Globe05",
      "Globe06"
    ],
    "tags": [
      "globe",
      "globe04",
      "globe 04"
    ]
  },
  {
    "name": "Globe05",
    "label": "Globe 05",
    "category": "Maps & travel",
    "baseFamily": "Globe",
    "isFirstVariant": false,
    "variantCount": 6,
    "familyVariants": [
      "Globe01",
      "Globe02",
      "Globe03",
      "Globe04",
      "Globe05",
      "Globe06"
    ],
    "tags": [
      "globe",
      "globe05",
      "globe 05"
    ]
  },
  {
    "name": "Globe06",
    "label": "Globe 06",
    "category": "Maps & travel",
    "baseFamily": "Globe",
    "isFirstVariant": false,
    "variantCount": 6,
    "familyVariants": [
      "Globe01",
      "Globe02",
      "Globe03",
      "Globe04",
      "Globe05",
      "Globe06"
    ],
    "tags": [
      "globe",
      "globe06",
      "globe 06"
    ]
  },
  {
    "name": "GlobeSlated01",
    "label": "Globe Slated 01",
    "category": "Maps & travel",
    "baseFamily": "GlobeSlated",
    "isFirstVariant": true,
    "variantCount": 2,
    "familyVariants": [
      "GlobeSlated01",
      "GlobeSlated02"
    ],
    "tags": [
      "globe",
      "slated",
      "globeslated01",
      "globe slated 01",
      "globeslated"
    ]
  },
  {
    "name": "GlobeSlated02",
    "label": "Globe Slated 02",
    "category": "Maps & travel",
    "baseFamily": "GlobeSlated",
    "isFirstVariant": false,
    "variantCount": 2,
    "familyVariants": [
      "GlobeSlated01",
      "GlobeSlated02"
    ],
    "tags": [
      "globe",
      "slated",
      "globeslated02",
      "globe slated 02",
      "globeslated"
    ]
  },
  {
    "name": "GoogleChrome",
    "label": "Google Chrome",
    "category": "General",
    "baseFamily": "GoogleChrome",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "GoogleChrome"
    ],
    "tags": [
      "google",
      "chrome",
      "googlechrome",
      "google chrome"
    ]
  },
  {
    "name": "GraduationHat01",
    "label": "Graduation Hat 01",
    "category": "Education",
    "baseFamily": "GraduationHat",
    "isFirstVariant": true,
    "variantCount": 2,
    "familyVariants": [
      "GraduationHat01",
      "GraduationHat02"
    ],
    "tags": [
      "graduation",
      "hat",
      "education",
      "college",
      "university",
      "tuition",
      "school",
      "degree",
      "training",
      "academic",
      "graduationhat01",
      "graduation hat 01",
      "graduationhat"
    ]
  },
  {
    "name": "GraduationHat02",
    "label": "Graduation Hat 02",
    "category": "Education",
    "baseFamily": "GraduationHat",
    "isFirstVariant": false,
    "variantCount": 2,
    "familyVariants": [
      "GraduationHat01",
      "GraduationHat02"
    ],
    "tags": [
      "graduation",
      "hat",
      "education",
      "college",
      "university",
      "tuition",
      "school",
      "degree",
      "training",
      "graduationhat02",
      "graduation hat 02",
      "graduationhat"
    ]
  },
  {
    "name": "Grid01",
    "label": "Grid 01",
    "category": "Layout",
    "baseFamily": "Grid",
    "isFirstVariant": true,
    "variantCount": 3,
    "familyVariants": [
      "Grid01",
      "Grid02",
      "Grid03"
    ],
    "tags": [
      "grid",
      "grid01",
      "grid 01"
    ]
  },
  {
    "name": "Grid02",
    "label": "Grid 02",
    "category": "Layout",
    "baseFamily": "Grid",
    "isFirstVariant": false,
    "variantCount": 3,
    "familyVariants": [
      "Grid01",
      "Grid02",
      "Grid03"
    ],
    "tags": [
      "grid",
      "grid02",
      "grid 02"
    ]
  },
  {
    "name": "Grid03",
    "label": "Grid 03",
    "category": "Layout",
    "baseFamily": "Grid",
    "isFirstVariant": false,
    "variantCount": 3,
    "familyVariants": [
      "Grid01",
      "Grid02",
      "Grid03"
    ],
    "tags": [
      "grid",
      "grid03",
      "grid 03"
    ]
  },
  {
    "name": "GridDotsBlank",
    "label": "Grid Dots Blank",
    "category": "Layout",
    "baseFamily": "GridDotsBlank",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "GridDotsBlank"
    ],
    "tags": [
      "grid",
      "dots",
      "blank",
      "griddotsblank",
      "grid dots blank"
    ]
  },
  {
    "name": "GridDotsBottom",
    "label": "Grid Dots Bottom",
    "category": "Layout",
    "baseFamily": "GridDotsBottom",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "GridDotsBottom"
    ],
    "tags": [
      "grid",
      "dots",
      "bottom",
      "griddotsbottom",
      "grid dots bottom"
    ]
  },
  {
    "name": "GridDotsHorizontalCenter",
    "label": "Grid Dots Horizontal Center",
    "category": "Layout",
    "baseFamily": "GridDotsHorizontalCenter",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "GridDotsHorizontalCenter"
    ],
    "tags": [
      "grid",
      "dots",
      "horizontal",
      "center",
      "griddotshorizontalcenter",
      "grid dots horizontal center"
    ]
  },
  {
    "name": "GridDotsLeft",
    "label": "Grid Dots Left",
    "category": "Layout",
    "baseFamily": "GridDotsLeft",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "GridDotsLeft"
    ],
    "tags": [
      "grid",
      "dots",
      "left",
      "griddotsleft",
      "grid dots left"
    ]
  },
  {
    "name": "GridDotsOuter",
    "label": "Grid Dots Outer",
    "category": "Layout",
    "baseFamily": "GridDotsOuter",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "GridDotsOuter"
    ],
    "tags": [
      "grid",
      "dots",
      "outer",
      "griddotsouter",
      "grid dots outer"
    ]
  },
  {
    "name": "GridDotsRight",
    "label": "Grid Dots Right",
    "category": "Layout",
    "baseFamily": "GridDotsRight",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "GridDotsRight"
    ],
    "tags": [
      "grid",
      "dots",
      "right",
      "griddotsright",
      "grid dots right"
    ]
  },
  {
    "name": "GridDotsTop",
    "label": "Grid Dots Top",
    "category": "Layout",
    "baseFamily": "GridDotsTop",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "GridDotsTop"
    ],
    "tags": [
      "grid",
      "dots",
      "top",
      "griddotstop",
      "grid dots top"
    ]
  },
  {
    "name": "GridDotsVerticalCenter",
    "label": "Grid Dots Vertical Center",
    "category": "Layout",
    "baseFamily": "GridDotsVerticalCenter",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "GridDotsVerticalCenter"
    ],
    "tags": [
      "grid",
      "dots",
      "vertical",
      "center",
      "griddotsverticalcenter",
      "grid dots vertical center"
    ]
  },
  {
    "name": "Hand",
    "label": "Hand",
    "category": "General",
    "baseFamily": "Hand",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "Hand"
    ],
    "tags": [
      "hand"
    ]
  },
  {
    "name": "HardDrive",
    "label": "Hard Drive",
    "category": "Media & devices",
    "baseFamily": "HardDrive",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "HardDrive"
    ],
    "tags": [
      "hard",
      "drive",
      "harddrive",
      "hard drive"
    ]
  },
  {
    "name": "Hash01",
    "label": "Hash 01",
    "category": "General",
    "baseFamily": "Hash",
    "isFirstVariant": true,
    "variantCount": 2,
    "familyVariants": [
      "Hash01",
      "Hash02"
    ],
    "tags": [
      "hash",
      "hash01",
      "hash 01"
    ]
  },
  {
    "name": "Hash02",
    "label": "Hash 02",
    "category": "General",
    "baseFamily": "Hash",
    "isFirstVariant": false,
    "variantCount": 2,
    "familyVariants": [
      "Hash01",
      "Hash02"
    ],
    "tags": [
      "hash",
      "hash02",
      "hash 02"
    ]
  },
  {
    "name": "Heading01",
    "label": "Heading 01",
    "category": "Editor",
    "baseFamily": "Heading",
    "isFirstVariant": true,
    "variantCount": 2,
    "familyVariants": [
      "Heading01",
      "Heading02"
    ],
    "tags": [
      "heading",
      "heading01",
      "heading 01"
    ]
  },
  {
    "name": "Heading02",
    "label": "Heading 02",
    "category": "Editor",
    "baseFamily": "Heading",
    "isFirstVariant": false,
    "variantCount": 2,
    "familyVariants": [
      "Heading01",
      "Heading02"
    ],
    "tags": [
      "heading",
      "heading02",
      "heading 02"
    ]
  },
  {
    "name": "HeadingSquare",
    "label": "Heading Square",
    "category": "Editor",
    "baseFamily": "HeadingSquare",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "HeadingSquare"
    ],
    "tags": [
      "heading",
      "square",
      "headingsquare",
      "heading square"
    ]
  },
  {
    "name": "Headphones01",
    "label": "Headphones 01",
    "category": "Media & devices",
    "baseFamily": "Headphones",
    "isFirstVariant": true,
    "variantCount": 2,
    "familyVariants": [
      "Headphones01",
      "Headphones02"
    ],
    "tags": [
      "headphones",
      "headphones01",
      "headphones 01"
    ]
  },
  {
    "name": "Headphones02",
    "label": "Headphones 02",
    "category": "Media & devices",
    "baseFamily": "Headphones",
    "isFirstVariant": false,
    "variantCount": 2,
    "familyVariants": [
      "Headphones01",
      "Headphones02"
    ],
    "tags": [
      "headphones",
      "headphones02",
      "headphones 02"
    ]
  },
  {
    "name": "Heart",
    "label": "Heart",
    "category": "Alerts & feedback",
    "baseFamily": "Heart",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "Heart"
    ],
    "tags": [
      "heart",
      "donation",
      "charity",
      "pets",
      "love",
      "like",
      "favorite",
      "health",
      "care",
      "passion"
    ]
  },
  {
    "name": "HeartCircle",
    "label": "Heart Circle",
    "category": "Alerts & feedback",
    "baseFamily": "HeartCircle",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "HeartCircle"
    ],
    "tags": [
      "heart",
      "circle",
      "heartcircle",
      "heart circle"
    ]
  },
  {
    "name": "HeartHand",
    "label": "Heart Hand",
    "category": "Alerts & feedback",
    "baseFamily": "HeartHand",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "HeartHand"
    ],
    "tags": [
      "heart",
      "hand",
      "charity",
      "volunteer",
      "aid",
      "support",
      "donate",
      "care",
      "hearthand",
      "heart hand"
    ]
  },
  {
    "name": "HeartHexagon",
    "label": "Heart Hexagon",
    "category": "Alerts & feedback",
    "baseFamily": "HeartHexagon",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "HeartHexagon"
    ],
    "tags": [
      "heart",
      "hexagon",
      "hearthexagon",
      "heart hexagon"
    ]
  },
  {
    "name": "HeartOctagon",
    "label": "Heart Octagon",
    "category": "Alerts & feedback",
    "baseFamily": "HeartOctagon",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "HeartOctagon"
    ],
    "tags": [
      "heart",
      "octagon",
      "heartoctagon",
      "heart octagon"
    ]
  },
  {
    "name": "HeartRounded",
    "label": "Heart Rounded",
    "category": "Alerts & feedback",
    "baseFamily": "HeartRounded",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "HeartRounded"
    ],
    "tags": [
      "heart",
      "rounded",
      "heartrounded",
      "heart rounded"
    ]
  },
  {
    "name": "HeartSquare",
    "label": "Heart Square",
    "category": "Alerts & feedback",
    "baseFamily": "HeartSquare",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "HeartSquare"
    ],
    "tags": [
      "heart",
      "square",
      "heartsquare",
      "heart square"
    ]
  },
  {
    "name": "Hearts",
    "label": "Hearts",
    "category": "Alerts & feedback",
    "baseFamily": "Hearts",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "Hearts"
    ],
    "tags": [
      "hearts"
    ]
  },
  {
    "name": "HelpCircle",
    "label": "Help Circle",
    "category": "Alerts & feedback",
    "baseFamily": "HelpCircle",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "HelpCircle"
    ],
    "tags": [
      "help",
      "circle",
      "helpcircle",
      "help circle"
    ]
  },
  {
    "name": "HelpOctagon",
    "label": "Help Octagon",
    "category": "Alerts & feedback",
    "baseFamily": "HelpOctagon",
    "isFirstVariant": false,
    "variantCount": 2,
    "familyVariants": [
      "HelpOctagon",
      "HelpOctagon1"
    ],
    "tags": [
      "help",
      "octagon",
      "helpoctagon",
      "help octagon"
    ]
  },
  {
    "name": "HelpOctagon1",
    "label": "Help Octagon 1",
    "category": "Alerts & feedback",
    "baseFamily": "HelpOctagon",
    "isFirstVariant": true,
    "variantCount": 2,
    "familyVariants": [
      "HelpOctagon",
      "HelpOctagon1"
    ],
    "tags": [
      "help",
      "octagon",
      "helpoctagon1",
      "help octagon 1",
      "helpoctagon"
    ]
  },
  {
    "name": "HelpSquare",
    "label": "Help Square",
    "category": "Alerts & feedback",
    "baseFamily": "HelpSquare",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "HelpSquare"
    ],
    "tags": [
      "help",
      "square",
      "helpsquare",
      "help square"
    ]
  },
  {
    "name": "Hexagon01",
    "label": "Hexagon 01",
    "category": "Shapes",
    "baseFamily": "Hexagon",
    "isFirstVariant": true,
    "variantCount": 2,
    "familyVariants": [
      "Hexagon01",
      "Hexagon02"
    ],
    "tags": [
      "hexagon",
      "hexagon01",
      "hexagon 01"
    ]
  },
  {
    "name": "Hexagon02",
    "label": "Hexagon 02",
    "category": "Shapes",
    "baseFamily": "Hexagon",
    "isFirstVariant": false,
    "variantCount": 2,
    "familyVariants": [
      "Hexagon01",
      "Hexagon02"
    ],
    "tags": [
      "hexagon",
      "hexagon02",
      "hexagon 02"
    ]
  },
  {
    "name": "Home01",
    "label": "Home 01",
    "category": "Maps & travel",
    "baseFamily": "Home",
    "isFirstVariant": true,
    "variantCount": 5,
    "familyVariants": [
      "Home01",
      "Home02",
      "Home03",
      "Home04",
      "Home05"
    ],
    "tags": [
      "home",
      "house",
      "property",
      "residence",
      "apartment",
      "mortgage",
      "rent",
      "living",
      "housing",
      "cottage",
      "home01",
      "home 01"
    ]
  },
  {
    "name": "Home02",
    "label": "Home 02",
    "category": "Maps & travel",
    "baseFamily": "Home",
    "isFirstVariant": false,
    "variantCount": 5,
    "familyVariants": [
      "Home01",
      "Home02",
      "Home03",
      "Home04",
      "Home05"
    ],
    "tags": [
      "home",
      "house",
      "property",
      "residence",
      "apartment",
      "mortgage",
      "rent",
      "home02",
      "home 02"
    ]
  },
  {
    "name": "Home03",
    "label": "Home 03",
    "category": "Maps & travel",
    "baseFamily": "Home",
    "isFirstVariant": false,
    "variantCount": 5,
    "familyVariants": [
      "Home01",
      "Home02",
      "Home03",
      "Home04",
      "Home05"
    ],
    "tags": [
      "home",
      "house",
      "property",
      "residence",
      "apartment",
      "mortgage",
      "rent",
      "home03",
      "home 03"
    ]
  },
  {
    "name": "Home04",
    "label": "Home 04",
    "category": "Maps & travel",
    "baseFamily": "Home",
    "isFirstVariant": false,
    "variantCount": 5,
    "familyVariants": [
      "Home01",
      "Home02",
      "Home03",
      "Home04",
      "Home05"
    ],
    "tags": [
      "home",
      "house",
      "property",
      "residence",
      "apartment",
      "mortgage",
      "rent",
      "home04",
      "home 04"
    ]
  },
  {
    "name": "Home05",
    "label": "Home 05",
    "category": "Maps & travel",
    "baseFamily": "Home",
    "isFirstVariant": false,
    "variantCount": 5,
    "familyVariants": [
      "Home01",
      "Home02",
      "Home03",
      "Home04",
      "Home05"
    ],
    "tags": [
      "home",
      "house",
      "property",
      "residence",
      "apartment",
      "mortgage",
      "rent",
      "home05",
      "home 05"
    ]
  },
  {
    "name": "HomeLine",
    "label": "Home Line",
    "category": "Maps & travel",
    "baseFamily": "HomeLine",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "HomeLine"
    ],
    "tags": [
      "home",
      "line",
      "homeline",
      "home line"
    ]
  },
  {
    "name": "HomeSmile",
    "label": "Home Smile",
    "category": "Maps & travel",
    "baseFamily": "HomeSmile",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "HomeSmile"
    ],
    "tags": [
      "home",
      "smile",
      "homesmile",
      "home smile"
    ]
  },
  {
    "name": "HorizontalBarChart01",
    "label": "Horizontal Bar Chart 01",
    "category": "Layout",
    "baseFamily": "HorizontalBarChart",
    "isFirstVariant": true,
    "variantCount": 3,
    "familyVariants": [
      "HorizontalBarChart01",
      "HorizontalBarChart02",
      "HorizontalBarChart03"
    ],
    "tags": [
      "horizontal",
      "bar",
      "chart",
      "horizontalbarchart01",
      "horizontal bar chart 01",
      "horizontalbarchart"
    ]
  },
  {
    "name": "HorizontalBarChart02",
    "label": "Horizontal Bar Chart 02",
    "category": "Layout",
    "baseFamily": "HorizontalBarChart",
    "isFirstVariant": false,
    "variantCount": 3,
    "familyVariants": [
      "HorizontalBarChart01",
      "HorizontalBarChart02",
      "HorizontalBarChart03"
    ],
    "tags": [
      "horizontal",
      "bar",
      "chart",
      "horizontalbarchart02",
      "horizontal bar chart 02",
      "horizontalbarchart"
    ]
  },
  {
    "name": "HorizontalBarChart03",
    "label": "Horizontal Bar Chart 03",
    "category": "Layout",
    "baseFamily": "HorizontalBarChart",
    "isFirstVariant": false,
    "variantCount": 3,
    "familyVariants": [
      "HorizontalBarChart01",
      "HorizontalBarChart02",
      "HorizontalBarChart03"
    ],
    "tags": [
      "horizontal",
      "bar",
      "chart",
      "horizontalbarchart03",
      "horizontal bar chart 03",
      "horizontalbarchart"
    ]
  },
  {
    "name": "Hourglass01",
    "label": "Hourglass 01",
    "category": "Time",
    "baseFamily": "Hourglass",
    "isFirstVariant": true,
    "variantCount": 3,
    "familyVariants": [
      "Hourglass01",
      "Hourglass02",
      "Hourglass03"
    ],
    "tags": [
      "hourglass",
      "hourglass01",
      "hourglass 01"
    ]
  },
  {
    "name": "Hourglass02",
    "label": "Hourglass 02",
    "category": "Time",
    "baseFamily": "Hourglass",
    "isFirstVariant": false,
    "variantCount": 3,
    "familyVariants": [
      "Hourglass01",
      "Hourglass02",
      "Hourglass03"
    ],
    "tags": [
      "hourglass",
      "hourglass02",
      "hourglass 02"
    ]
  },
  {
    "name": "Hourglass03",
    "label": "Hourglass 03",
    "category": "Time",
    "baseFamily": "Hourglass",
    "isFirstVariant": false,
    "variantCount": 3,
    "familyVariants": [
      "Hourglass01",
      "Hourglass02",
      "Hourglass03"
    ],
    "tags": [
      "hourglass",
      "hourglass03",
      "hourglass 03"
    ]
  },
  {
    "name": "Hurricane01",
    "label": "Hurricane 01",
    "category": "Weather",
    "baseFamily": "Hurricane",
    "isFirstVariant": true,
    "variantCount": 3,
    "familyVariants": [
      "Hurricane01",
      "Hurricane02",
      "Hurricane03"
    ],
    "tags": [
      "hurricane",
      "hurricane01",
      "hurricane 01"
    ]
  },
  {
    "name": "Hurricane02",
    "label": "Hurricane 02",
    "category": "Weather",
    "baseFamily": "Hurricane",
    "isFirstVariant": false,
    "variantCount": 3,
    "familyVariants": [
      "Hurricane01",
      "Hurricane02",
      "Hurricane03"
    ],
    "tags": [
      "hurricane",
      "hurricane02",
      "hurricane 02"
    ]
  },
  {
    "name": "Hurricane03",
    "label": "Hurricane 03",
    "category": "Weather",
    "baseFamily": "Hurricane",
    "isFirstVariant": false,
    "variantCount": 3,
    "familyVariants": [
      "Hurricane01",
      "Hurricane02",
      "Hurricane03"
    ],
    "tags": [
      "hurricane",
      "hurricane03",
      "hurricane 03"
    ]
  },
  {
    "name": "Image01",
    "label": "Image 01",
    "category": "Images",
    "baseFamily": "Image",
    "isFirstVariant": true,
    "variantCount": 5,
    "familyVariants": [
      "Image01",
      "Image02",
      "Image03",
      "Image04",
      "Image05"
    ],
    "tags": [
      "image",
      "image01",
      "image 01"
    ]
  },
  {
    "name": "Image02",
    "label": "Image 02",
    "category": "Images",
    "baseFamily": "Image",
    "isFirstVariant": false,
    "variantCount": 5,
    "familyVariants": [
      "Image01",
      "Image02",
      "Image03",
      "Image04",
      "Image05"
    ],
    "tags": [
      "image",
      "image02",
      "image 02"
    ]
  },
  {
    "name": "Image03",
    "label": "Image 03",
    "category": "Images",
    "baseFamily": "Image",
    "isFirstVariant": false,
    "variantCount": 5,
    "familyVariants": [
      "Image01",
      "Image02",
      "Image03",
      "Image04",
      "Image05"
    ],
    "tags": [
      "image",
      "image03",
      "image 03"
    ]
  },
  {
    "name": "Image04",
    "label": "Image 04",
    "category": "Images",
    "baseFamily": "Image",
    "isFirstVariant": false,
    "variantCount": 5,
    "familyVariants": [
      "Image01",
      "Image02",
      "Image03",
      "Image04",
      "Image05"
    ],
    "tags": [
      "image",
      "image04",
      "image 04"
    ]
  },
  {
    "name": "Image05",
    "label": "Image 05",
    "category": "Images",
    "baseFamily": "Image",
    "isFirstVariant": false,
    "variantCount": 5,
    "familyVariants": [
      "Image01",
      "Image02",
      "Image03",
      "Image04",
      "Image05"
    ],
    "tags": [
      "image",
      "image05",
      "image 05"
    ]
  },
  {
    "name": "ImageCheck",
    "label": "Image Check",
    "category": "Images",
    "baseFamily": "ImageCheck",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "ImageCheck"
    ],
    "tags": [
      "image",
      "check",
      "imagecheck",
      "image check"
    ]
  },
  {
    "name": "ImageDown",
    "label": "Image Down",
    "category": "Images",
    "baseFamily": "ImageDown",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "ImageDown"
    ],
    "tags": [
      "image",
      "down",
      "imagedown",
      "image down"
    ]
  },
  {
    "name": "ImageIndentLeft",
    "label": "Image Indent Left",
    "category": "Images",
    "baseFamily": "ImageIndentLeft",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "ImageIndentLeft"
    ],
    "tags": [
      "image",
      "indent",
      "left",
      "imageindentleft",
      "image indent left"
    ]
  },
  {
    "name": "ImageIndentRight",
    "label": "Image Indent Right",
    "category": "Images",
    "baseFamily": "ImageIndentRight",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "ImageIndentRight"
    ],
    "tags": [
      "image",
      "indent",
      "right",
      "imageindentright",
      "image indent right"
    ]
  },
  {
    "name": "ImageLeft",
    "label": "Image Left",
    "category": "Images",
    "baseFamily": "ImageLeft",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "ImageLeft"
    ],
    "tags": [
      "image",
      "left",
      "imageleft",
      "image left"
    ]
  },
  {
    "name": "ImagePlus",
    "label": "Image Plus",
    "category": "Images",
    "baseFamily": "ImagePlus",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "ImagePlus"
    ],
    "tags": [
      "image",
      "plus",
      "imageplus",
      "image plus"
    ]
  },
  {
    "name": "ImageRight",
    "label": "Image Right",
    "category": "Images",
    "baseFamily": "ImageRight",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "ImageRight"
    ],
    "tags": [
      "image",
      "right",
      "imageright",
      "image right"
    ]
  },
  {
    "name": "ImageUp",
    "label": "Image Up",
    "category": "Images",
    "baseFamily": "ImageUp",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "ImageUp"
    ],
    "tags": [
      "image",
      "up",
      "imageup",
      "image up"
    ]
  },
  {
    "name": "ImageUser",
    "label": "Image User",
    "category": "Images",
    "baseFamily": "ImageUser",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "ImageUser"
    ],
    "tags": [
      "image",
      "user",
      "imageuser",
      "image user"
    ]
  },
  {
    "name": "ImageUserCheck",
    "label": "Image User Check",
    "category": "Images",
    "baseFamily": "ImageUserCheck",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "ImageUserCheck"
    ],
    "tags": [
      "image",
      "user",
      "check",
      "imageusercheck",
      "image user check"
    ]
  },
  {
    "name": "ImageUserDown",
    "label": "Image User Down",
    "category": "Images",
    "baseFamily": "ImageUserDown",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "ImageUserDown"
    ],
    "tags": [
      "image",
      "user",
      "down",
      "imageuserdown",
      "image user down"
    ]
  },
  {
    "name": "ImageUserLeft",
    "label": "Image User Left",
    "category": "Images",
    "baseFamily": "ImageUserLeft",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "ImageUserLeft"
    ],
    "tags": [
      "image",
      "user",
      "left",
      "imageuserleft",
      "image user left"
    ]
  },
  {
    "name": "ImageUserPlus",
    "label": "Image User Plus",
    "category": "Images",
    "baseFamily": "ImageUserPlus",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "ImageUserPlus"
    ],
    "tags": [
      "image",
      "user",
      "plus",
      "imageuserplus",
      "image user plus"
    ]
  },
  {
    "name": "ImageUserRight",
    "label": "Image User Right",
    "category": "Images",
    "baseFamily": "ImageUserRight",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "ImageUserRight"
    ],
    "tags": [
      "image",
      "user",
      "right",
      "imageuserright",
      "image user right"
    ]
  },
  {
    "name": "ImageUserUp",
    "label": "Image User Up",
    "category": "Images",
    "baseFamily": "ImageUserUp",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "ImageUserUp"
    ],
    "tags": [
      "image",
      "user",
      "up",
      "imageuserup",
      "image user up"
    ]
  },
  {
    "name": "ImageUserX",
    "label": "Image User X",
    "category": "Images",
    "baseFamily": "ImageUserX",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "ImageUserX"
    ],
    "tags": [
      "image",
      "user",
      "x",
      "imageuserx",
      "image user x"
    ]
  },
  {
    "name": "ImageX",
    "label": "Image X",
    "category": "Images",
    "baseFamily": "ImageX",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "ImageX"
    ],
    "tags": [
      "image",
      "x",
      "imagex",
      "image x"
    ]
  },
  {
    "name": "Inbox01",
    "label": "Inbox 01",
    "category": "Communication",
    "baseFamily": "Inbox",
    "isFirstVariant": true,
    "variantCount": 2,
    "familyVariants": [
      "Inbox01",
      "Inbox02"
    ],
    "tags": [
      "inbox",
      "inbox01",
      "inbox 01"
    ]
  },
  {
    "name": "Inbox02",
    "label": "Inbox 02",
    "category": "Communication",
    "baseFamily": "Inbox",
    "isFirstVariant": false,
    "variantCount": 2,
    "familyVariants": [
      "Inbox01",
      "Inbox02"
    ],
    "tags": [
      "inbox",
      "inbox02",
      "inbox 02"
    ]
  },
  {
    "name": "Infinity",
    "label": "Infinity",
    "category": "General",
    "baseFamily": "Infinity",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "Infinity"
    ],
    "tags": [
      "infinity"
    ]
  },
  {
    "name": "InfoCircle",
    "label": "Info Circle",
    "category": "Alerts & feedback",
    "baseFamily": "InfoCircle",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "InfoCircle"
    ],
    "tags": [
      "info",
      "circle",
      "infocircle",
      "info circle"
    ]
  },
  {
    "name": "InfoHexagon",
    "label": "Info Hexagon",
    "category": "Alerts & feedback",
    "baseFamily": "InfoHexagon",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "InfoHexagon"
    ],
    "tags": [
      "info",
      "hexagon",
      "infohexagon",
      "info hexagon"
    ]
  },
  {
    "name": "InfoOctagon",
    "label": "Info Octagon",
    "category": "Alerts & feedback",
    "baseFamily": "InfoOctagon",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "InfoOctagon"
    ],
    "tags": [
      "info",
      "octagon",
      "infooctagon",
      "info octagon"
    ]
  },
  {
    "name": "InfoSquare",
    "label": "Info Square",
    "category": "Alerts & feedback",
    "baseFamily": "InfoSquare",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "InfoSquare"
    ],
    "tags": [
      "info",
      "square",
      "infosquare",
      "info square"
    ]
  },
  {
    "name": "IntersectCircle",
    "label": "Intersect Circle",
    "category": "General",
    "baseFamily": "IntersectCircle",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "IntersectCircle"
    ],
    "tags": [
      "intersect",
      "circle",
      "intersectcircle",
      "intersect circle"
    ]
  },
  {
    "name": "IntersectSquare",
    "label": "Intersect Square",
    "category": "General",
    "baseFamily": "IntersectSquare",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "IntersectSquare"
    ],
    "tags": [
      "intersect",
      "square",
      "intersectsquare",
      "intersect square"
    ]
  },
  {
    "name": "Italic01",
    "label": "Italic 01",
    "category": "Editor",
    "baseFamily": "Italic",
    "isFirstVariant": true,
    "variantCount": 2,
    "familyVariants": [
      "Italic01",
      "Italic02"
    ],
    "tags": [
      "italic",
      "italic01",
      "italic 01"
    ]
  },
  {
    "name": "Italic02",
    "label": "Italic 02",
    "category": "Editor",
    "baseFamily": "Italic",
    "isFirstVariant": false,
    "variantCount": 2,
    "familyVariants": [
      "Italic01",
      "Italic02"
    ],
    "tags": [
      "italic",
      "italic02",
      "italic 02"
    ]
  },
  {
    "name": "ItalicSquare",
    "label": "Italic Square",
    "category": "Editor",
    "baseFamily": "ItalicSquare",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "ItalicSquare"
    ],
    "tags": [
      "italic",
      "square",
      "italicsquare",
      "italic square"
    ]
  },
  {
    "name": "Key01",
    "label": "Key 01",
    "category": "Security",
    "baseFamily": "Key",
    "isFirstVariant": true,
    "variantCount": 2,
    "familyVariants": [
      "Key01",
      "Key02"
    ],
    "tags": [
      "key",
      "access",
      "password",
      "login",
      "security",
      "unlock",
      "secret",
      "key01",
      "key 01"
    ]
  },
  {
    "name": "Key02",
    "label": "Key 02",
    "category": "Security",
    "baseFamily": "Key",
    "isFirstVariant": false,
    "variantCount": 2,
    "familyVariants": [
      "Key01",
      "Key02"
    ],
    "tags": [
      "key",
      "access",
      "password",
      "login",
      "security",
      "unlock",
      "key02",
      "key 02"
    ]
  },
  {
    "name": "Keyboard01",
    "label": "Keyboard 01",
    "category": "Media & devices",
    "baseFamily": "Keyboard",
    "isFirstVariant": true,
    "variantCount": 2,
    "familyVariants": [
      "Keyboard01",
      "Keyboard02"
    ],
    "tags": [
      "keyboard",
      "keyboard01",
      "keyboard 01"
    ]
  },
  {
    "name": "Keyboard02",
    "label": "Keyboard 02",
    "category": "Media & devices",
    "baseFamily": "Keyboard",
    "isFirstVariant": false,
    "variantCount": 2,
    "familyVariants": [
      "Keyboard01",
      "Keyboard02"
    ],
    "tags": [
      "keyboard",
      "keyboard02",
      "keyboard 02"
    ]
  },
  {
    "name": "Laptop01",
    "label": "Laptop 01",
    "category": "Media & devices",
    "baseFamily": "Laptop",
    "isFirstVariant": true,
    "variantCount": 2,
    "familyVariants": [
      "Laptop01",
      "Laptop02"
    ],
    "tags": [
      "laptop",
      "laptop01",
      "laptop 01"
    ]
  },
  {
    "name": "Laptop02",
    "label": "Laptop 02",
    "category": "Media & devices",
    "baseFamily": "Laptop",
    "isFirstVariant": false,
    "variantCount": 2,
    "familyVariants": [
      "Laptop01",
      "Laptop02"
    ],
    "tags": [
      "laptop",
      "laptop02",
      "laptop 02"
    ]
  },
  {
    "name": "LayerSingle",
    "label": "Layer Single",
    "category": "Layout",
    "baseFamily": "LayerSingle",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "LayerSingle"
    ],
    "tags": [
      "layer",
      "single",
      "layersingle",
      "layer single"
    ]
  },
  {
    "name": "LayersThree01",
    "label": "Layers Three 01",
    "category": "Layout",
    "baseFamily": "LayersThree",
    "isFirstVariant": true,
    "variantCount": 2,
    "familyVariants": [
      "LayersThree01",
      "LayersThree02"
    ],
    "tags": [
      "layers",
      "three",
      "layersthree01",
      "layers three 01",
      "layersthree"
    ]
  },
  {
    "name": "LayersThree02",
    "label": "Layers Three 02",
    "category": "Layout",
    "baseFamily": "LayersThree",
    "isFirstVariant": false,
    "variantCount": 2,
    "familyVariants": [
      "LayersThree01",
      "LayersThree02"
    ],
    "tags": [
      "layers",
      "three",
      "layersthree02",
      "layers three 02",
      "layersthree"
    ]
  },
  {
    "name": "LayersTwo01",
    "label": "Layers Two 01",
    "category": "Layout",
    "baseFamily": "LayersTwo",
    "isFirstVariant": true,
    "variantCount": 2,
    "familyVariants": [
      "LayersTwo01",
      "LayersTwo02"
    ],
    "tags": [
      "layers",
      "two",
      "layerstwo01",
      "layers two 01",
      "layerstwo"
    ]
  },
  {
    "name": "LayersTwo02",
    "label": "Layers Two 02",
    "category": "Layout",
    "baseFamily": "LayersTwo",
    "isFirstVariant": false,
    "variantCount": 2,
    "familyVariants": [
      "LayersTwo01",
      "LayersTwo02"
    ],
    "tags": [
      "layers",
      "two",
      "layerstwo02",
      "layers two 02",
      "layerstwo"
    ]
  },
  {
    "name": "LayoutAlt01",
    "label": "Layout Alt 01",
    "category": "Layout",
    "baseFamily": "LayoutAlt",
    "isFirstVariant": true,
    "variantCount": 4,
    "familyVariants": [
      "LayoutAlt01",
      "LayoutAlt02",
      "LayoutAlt03",
      "LayoutAlt04"
    ],
    "tags": [
      "layout",
      "alt",
      "layoutalt01",
      "layout alt 01",
      "layoutalt"
    ]
  },
  {
    "name": "LayoutAlt02",
    "label": "Layout Alt 02",
    "category": "Layout",
    "baseFamily": "LayoutAlt",
    "isFirstVariant": false,
    "variantCount": 4,
    "familyVariants": [
      "LayoutAlt01",
      "LayoutAlt02",
      "LayoutAlt03",
      "LayoutAlt04"
    ],
    "tags": [
      "layout",
      "alt",
      "layoutalt02",
      "layout alt 02",
      "layoutalt"
    ]
  },
  {
    "name": "LayoutAlt03",
    "label": "Layout Alt 03",
    "category": "Layout",
    "baseFamily": "LayoutAlt",
    "isFirstVariant": false,
    "variantCount": 4,
    "familyVariants": [
      "LayoutAlt01",
      "LayoutAlt02",
      "LayoutAlt03",
      "LayoutAlt04"
    ],
    "tags": [
      "layout",
      "alt",
      "layoutalt03",
      "layout alt 03",
      "layoutalt"
    ]
  },
  {
    "name": "LayoutAlt04",
    "label": "Layout Alt 04",
    "category": "Layout",
    "baseFamily": "LayoutAlt",
    "isFirstVariant": false,
    "variantCount": 4,
    "familyVariants": [
      "LayoutAlt01",
      "LayoutAlt02",
      "LayoutAlt03",
      "LayoutAlt04"
    ],
    "tags": [
      "layout",
      "alt",
      "layoutalt04",
      "layout alt 04",
      "layoutalt"
    ]
  },
  {
    "name": "LayoutBottom",
    "label": "Layout Bottom",
    "category": "Layout",
    "baseFamily": "LayoutBottom",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "LayoutBottom"
    ],
    "tags": [
      "layout",
      "bottom",
      "layoutbottom",
      "layout bottom"
    ]
  },
  {
    "name": "LayoutGrid01",
    "label": "Layout Grid 01",
    "category": "Layout",
    "baseFamily": "LayoutGrid",
    "isFirstVariant": true,
    "variantCount": 2,
    "familyVariants": [
      "LayoutGrid01",
      "LayoutGrid02"
    ],
    "tags": [
      "layout",
      "grid",
      "layoutgrid01",
      "layout grid 01",
      "layoutgrid"
    ]
  },
  {
    "name": "LayoutGrid02",
    "label": "Layout Grid 02",
    "category": "Layout",
    "baseFamily": "LayoutGrid",
    "isFirstVariant": false,
    "variantCount": 2,
    "familyVariants": [
      "LayoutGrid01",
      "LayoutGrid02"
    ],
    "tags": [
      "layout",
      "grid",
      "layoutgrid02",
      "layout grid 02",
      "layoutgrid"
    ]
  },
  {
    "name": "LayoutLeft",
    "label": "Layout Left",
    "category": "Layout",
    "baseFamily": "LayoutLeft",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "LayoutLeft"
    ],
    "tags": [
      "layout",
      "left",
      "layoutleft",
      "layout left"
    ]
  },
  {
    "name": "LayoutRight",
    "label": "Layout Right",
    "category": "Layout",
    "baseFamily": "LayoutRight",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "LayoutRight"
    ],
    "tags": [
      "layout",
      "right",
      "layoutright",
      "layout right"
    ]
  },
  {
    "name": "LayoutTop",
    "label": "Layout Top",
    "category": "Layout",
    "baseFamily": "LayoutTop",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "LayoutTop"
    ],
    "tags": [
      "layout",
      "top",
      "layouttop",
      "layout top"
    ]
  },
  {
    "name": "LeftIndent01",
    "label": "Left Indent 01",
    "category": "General",
    "baseFamily": "LeftIndent",
    "isFirstVariant": true,
    "variantCount": 2,
    "familyVariants": [
      "LeftIndent01",
      "LeftIndent02"
    ],
    "tags": [
      "left",
      "indent",
      "leftindent01",
      "left indent 01",
      "leftindent"
    ]
  },
  {
    "name": "LeftIndent02",
    "label": "Left Indent 02",
    "category": "General",
    "baseFamily": "LeftIndent",
    "isFirstVariant": false,
    "variantCount": 2,
    "familyVariants": [
      "LeftIndent01",
      "LeftIndent02"
    ],
    "tags": [
      "left",
      "indent",
      "leftindent02",
      "left indent 02",
      "leftindent"
    ]
  },
  {
    "name": "LetterSpacing01",
    "label": "Letter Spacing 01",
    "category": "General",
    "baseFamily": "LetterSpacing",
    "isFirstVariant": true,
    "variantCount": 2,
    "familyVariants": [
      "LetterSpacing01",
      "LetterSpacing02"
    ],
    "tags": [
      "letter",
      "spacing",
      "letterspacing01",
      "letter spacing 01",
      "letterspacing"
    ]
  },
  {
    "name": "LetterSpacing02",
    "label": "Letter Spacing 02",
    "category": "General",
    "baseFamily": "LetterSpacing",
    "isFirstVariant": false,
    "variantCount": 2,
    "familyVariants": [
      "LetterSpacing01",
      "LetterSpacing02"
    ],
    "tags": [
      "letter",
      "spacing",
      "letterspacing02",
      "letter spacing 02",
      "letterspacing"
    ]
  },
  {
    "name": "LifeBuoy01",
    "label": "Life Buoy 01",
    "category": "General",
    "baseFamily": "LifeBuoy",
    "isFirstVariant": true,
    "variantCount": 2,
    "familyVariants": [
      "LifeBuoy01",
      "LifeBuoy02"
    ],
    "tags": [
      "life",
      "buoy",
      "lifebuoy01",
      "life buoy 01",
      "lifebuoy"
    ]
  },
  {
    "name": "LifeBuoy02",
    "label": "Life Buoy 02",
    "category": "General",
    "baseFamily": "LifeBuoy",
    "isFirstVariant": false,
    "variantCount": 2,
    "familyVariants": [
      "LifeBuoy01",
      "LifeBuoy02"
    ],
    "tags": [
      "life",
      "buoy",
      "lifebuoy02",
      "life buoy 02",
      "lifebuoy"
    ]
  },
  {
    "name": "Lightbulb01",
    "label": "Lightbulb 01",
    "category": "General",
    "baseFamily": "Lightbulb",
    "isFirstVariant": true,
    "variantCount": 5,
    "familyVariants": [
      "Lightbulb01",
      "Lightbulb02",
      "Lightbulb03",
      "Lightbulb04",
      "Lightbulb05"
    ],
    "tags": [
      "lightbulb",
      "lightbulb01",
      "lightbulb 01"
    ]
  },
  {
    "name": "Lightbulb02",
    "label": "Lightbulb 02",
    "category": "General",
    "baseFamily": "Lightbulb",
    "isFirstVariant": false,
    "variantCount": 5,
    "familyVariants": [
      "Lightbulb01",
      "Lightbulb02",
      "Lightbulb03",
      "Lightbulb04",
      "Lightbulb05"
    ],
    "tags": [
      "lightbulb",
      "lightbulb02",
      "lightbulb 02"
    ]
  },
  {
    "name": "Lightbulb03",
    "label": "Lightbulb 03",
    "category": "General",
    "baseFamily": "Lightbulb",
    "isFirstVariant": false,
    "variantCount": 5,
    "familyVariants": [
      "Lightbulb01",
      "Lightbulb02",
      "Lightbulb03",
      "Lightbulb04",
      "Lightbulb05"
    ],
    "tags": [
      "lightbulb",
      "lightbulb03",
      "lightbulb 03"
    ]
  },
  {
    "name": "Lightbulb04",
    "label": "Lightbulb 04",
    "category": "General",
    "baseFamily": "Lightbulb",
    "isFirstVariant": false,
    "variantCount": 5,
    "familyVariants": [
      "Lightbulb01",
      "Lightbulb02",
      "Lightbulb03",
      "Lightbulb04",
      "Lightbulb05"
    ],
    "tags": [
      "lightbulb",
      "lightbulb04",
      "lightbulb 04"
    ]
  },
  {
    "name": "Lightbulb05",
    "label": "Lightbulb 05",
    "category": "General",
    "baseFamily": "Lightbulb",
    "isFirstVariant": false,
    "variantCount": 5,
    "familyVariants": [
      "Lightbulb01",
      "Lightbulb02",
      "Lightbulb03",
      "Lightbulb04",
      "Lightbulb05"
    ],
    "tags": [
      "lightbulb",
      "lightbulb05",
      "lightbulb 05"
    ]
  },
  {
    "name": "Lightning01",
    "label": "Lightning 01",
    "category": "General",
    "baseFamily": "Lightning",
    "isFirstVariant": true,
    "variantCount": 2,
    "familyVariants": [
      "Lightning01",
      "Lightning02"
    ],
    "tags": [
      "lightning",
      "lightning01",
      "lightning 01"
    ]
  },
  {
    "name": "Lightning02",
    "label": "Lightning 02",
    "category": "General",
    "baseFamily": "Lightning",
    "isFirstVariant": false,
    "variantCount": 2,
    "familyVariants": [
      "Lightning01",
      "Lightning02"
    ],
    "tags": [
      "lightning",
      "lightning02",
      "lightning 02"
    ]
  },
  {
    "name": "LineChartDown01",
    "label": "Line Chart Down 01",
    "category": "Charts",
    "baseFamily": "LineChartDown",
    "isFirstVariant": true,
    "variantCount": 5,
    "familyVariants": [
      "LineChartDown01",
      "LineChartDown02",
      "LineChartDown03",
      "LineChartDown04",
      "LineChartDown05"
    ],
    "tags": [
      "line",
      "chart",
      "down",
      "stocks",
      "market",
      "trading",
      "downtrend",
      "bear market",
      "linechartdown01",
      "line chart down 01",
      "linechartdown"
    ]
  },
  {
    "name": "LineChartDown02",
    "label": "Line Chart Down 02",
    "category": "Charts",
    "baseFamily": "LineChartDown",
    "isFirstVariant": false,
    "variantCount": 5,
    "familyVariants": [
      "LineChartDown01",
      "LineChartDown02",
      "LineChartDown03",
      "LineChartDown04",
      "LineChartDown05"
    ],
    "tags": [
      "line",
      "chart",
      "down",
      "linechartdown02",
      "line chart down 02",
      "linechartdown"
    ]
  },
  {
    "name": "LineChartDown03",
    "label": "Line Chart Down 03",
    "category": "Charts",
    "baseFamily": "LineChartDown",
    "isFirstVariant": false,
    "variantCount": 5,
    "familyVariants": [
      "LineChartDown01",
      "LineChartDown02",
      "LineChartDown03",
      "LineChartDown04",
      "LineChartDown05"
    ],
    "tags": [
      "line",
      "chart",
      "down",
      "linechartdown03",
      "line chart down 03",
      "linechartdown"
    ]
  },
  {
    "name": "LineChartDown04",
    "label": "Line Chart Down 04",
    "category": "Charts",
    "baseFamily": "LineChartDown",
    "isFirstVariant": false,
    "variantCount": 5,
    "familyVariants": [
      "LineChartDown01",
      "LineChartDown02",
      "LineChartDown03",
      "LineChartDown04",
      "LineChartDown05"
    ],
    "tags": [
      "line",
      "chart",
      "down",
      "linechartdown04",
      "line chart down 04",
      "linechartdown"
    ]
  },
  {
    "name": "LineChartDown05",
    "label": "Line Chart Down 05",
    "category": "Charts",
    "baseFamily": "LineChartDown",
    "isFirstVariant": false,
    "variantCount": 5,
    "familyVariants": [
      "LineChartDown01",
      "LineChartDown02",
      "LineChartDown03",
      "LineChartDown04",
      "LineChartDown05"
    ],
    "tags": [
      "line",
      "chart",
      "down",
      "linechartdown05",
      "line chart down 05",
      "linechartdown"
    ]
  },
  {
    "name": "LineChartUp01",
    "label": "Line Chart Up 01",
    "category": "Charts",
    "baseFamily": "LineChartUp",
    "isFirstVariant": true,
    "variantCount": 5,
    "familyVariants": [
      "LineChartUp01",
      "LineChartUp02",
      "LineChartUp03",
      "LineChartUp04",
      "LineChartUp05"
    ],
    "tags": [
      "line",
      "chart",
      "up",
      "stocks",
      "candlestick",
      "market",
      "trading",
      "shares",
      "investing",
      "securities",
      "linechartup01",
      "line chart up 01",
      "linechartup"
    ]
  },
  {
    "name": "LineChartUp02",
    "label": "Line Chart Up 02",
    "category": "Charts",
    "baseFamily": "LineChartUp",
    "isFirstVariant": false,
    "variantCount": 5,
    "familyVariants": [
      "LineChartUp01",
      "LineChartUp02",
      "LineChartUp03",
      "LineChartUp04",
      "LineChartUp05"
    ],
    "tags": [
      "line",
      "chart",
      "up",
      "linechartup02",
      "line chart up 02",
      "linechartup"
    ]
  },
  {
    "name": "LineChartUp03",
    "label": "Line Chart Up 03",
    "category": "Charts",
    "baseFamily": "LineChartUp",
    "isFirstVariant": false,
    "variantCount": 5,
    "familyVariants": [
      "LineChartUp01",
      "LineChartUp02",
      "LineChartUp03",
      "LineChartUp04",
      "LineChartUp05"
    ],
    "tags": [
      "line",
      "chart",
      "up",
      "linechartup03",
      "line chart up 03",
      "linechartup"
    ]
  },
  {
    "name": "LineChartUp04",
    "label": "Line Chart Up 04",
    "category": "Charts",
    "baseFamily": "LineChartUp",
    "isFirstVariant": false,
    "variantCount": 5,
    "familyVariants": [
      "LineChartUp01",
      "LineChartUp02",
      "LineChartUp03",
      "LineChartUp04",
      "LineChartUp05"
    ],
    "tags": [
      "line",
      "chart",
      "up",
      "linechartup04",
      "line chart up 04",
      "linechartup"
    ]
  },
  {
    "name": "LineChartUp05",
    "label": "Line Chart Up 05",
    "category": "Charts",
    "baseFamily": "LineChartUp",
    "isFirstVariant": false,
    "variantCount": 5,
    "familyVariants": [
      "LineChartUp01",
      "LineChartUp02",
      "LineChartUp03",
      "LineChartUp04",
      "LineChartUp05"
    ],
    "tags": [
      "line",
      "chart",
      "up",
      "linechartup05",
      "line chart up 05",
      "linechartup"
    ]
  },
  {
    "name": "LineHeight",
    "label": "Line Height",
    "category": "General",
    "baseFamily": "LineHeight",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "LineHeight"
    ],
    "tags": [
      "line",
      "height",
      "lineheight",
      "line height"
    ]
  },
  {
    "name": "Link01",
    "label": "Link 01",
    "category": "Editor",
    "baseFamily": "Link",
    "isFirstVariant": true,
    "variantCount": 5,
    "familyVariants": [
      "Link01",
      "Link02",
      "Link03",
      "Link04",
      "Link05"
    ],
    "tags": [
      "link",
      "link01",
      "link 01"
    ]
  },
  {
    "name": "Link02",
    "label": "Link 02",
    "category": "Editor",
    "baseFamily": "Link",
    "isFirstVariant": false,
    "variantCount": 5,
    "familyVariants": [
      "Link01",
      "Link02",
      "Link03",
      "Link04",
      "Link05"
    ],
    "tags": [
      "link",
      "link02",
      "link 02"
    ]
  },
  {
    "name": "Link03",
    "label": "Link 03",
    "category": "Editor",
    "baseFamily": "Link",
    "isFirstVariant": false,
    "variantCount": 5,
    "familyVariants": [
      "Link01",
      "Link02",
      "Link03",
      "Link04",
      "Link05"
    ],
    "tags": [
      "link",
      "link03",
      "link 03"
    ]
  },
  {
    "name": "Link04",
    "label": "Link 04",
    "category": "Editor",
    "baseFamily": "Link",
    "isFirstVariant": false,
    "variantCount": 5,
    "familyVariants": [
      "Link01",
      "Link02",
      "Link03",
      "Link04",
      "Link05"
    ],
    "tags": [
      "link",
      "link04",
      "link 04"
    ]
  },
  {
    "name": "Link05",
    "label": "Link 05",
    "category": "Editor",
    "baseFamily": "Link",
    "isFirstVariant": false,
    "variantCount": 5,
    "familyVariants": [
      "Link01",
      "Link02",
      "Link03",
      "Link04",
      "Link05"
    ],
    "tags": [
      "link",
      "link05",
      "link 05"
    ]
  },
  {
    "name": "LinkBroken01",
    "label": "Link Broken 01",
    "category": "Editor",
    "baseFamily": "LinkBroken",
    "isFirstVariant": true,
    "variantCount": 2,
    "familyVariants": [
      "LinkBroken01",
      "LinkBroken02"
    ],
    "tags": [
      "link",
      "broken",
      "linkbroken01",
      "link broken 01",
      "linkbroken"
    ]
  },
  {
    "name": "LinkBroken02",
    "label": "Link Broken 02",
    "category": "Editor",
    "baseFamily": "LinkBroken",
    "isFirstVariant": false,
    "variantCount": 2,
    "familyVariants": [
      "LinkBroken01",
      "LinkBroken02"
    ],
    "tags": [
      "link",
      "broken",
      "linkbroken02",
      "link broken 02",
      "linkbroken"
    ]
  },
  {
    "name": "LinkExternal01",
    "label": "Link External 01",
    "category": "Editor",
    "baseFamily": "LinkExternal",
    "isFirstVariant": true,
    "variantCount": 2,
    "familyVariants": [
      "LinkExternal01",
      "LinkExternal02"
    ],
    "tags": [
      "link",
      "external",
      "linkexternal01",
      "link external 01",
      "linkexternal"
    ]
  },
  {
    "name": "LinkExternal02",
    "label": "Link External 02",
    "category": "Editor",
    "baseFamily": "LinkExternal",
    "isFirstVariant": false,
    "variantCount": 2,
    "familyVariants": [
      "LinkExternal01",
      "LinkExternal02"
    ],
    "tags": [
      "link",
      "external",
      "linkexternal02",
      "link external 02",
      "linkexternal"
    ]
  },
  {
    "name": "List",
    "label": "List",
    "category": "Layout",
    "baseFamily": "List",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "List"
    ],
    "tags": [
      "list"
    ]
  },
  {
    "name": "Loading01",
    "label": "Loading 01",
    "category": "General",
    "baseFamily": "Loading",
    "isFirstVariant": true,
    "variantCount": 3,
    "familyVariants": [
      "Loading01",
      "Loading02",
      "Loading03"
    ],
    "tags": [
      "loading",
      "loading01",
      "loading 01"
    ]
  },
  {
    "name": "Loading02",
    "label": "Loading 02",
    "category": "General",
    "baseFamily": "Loading",
    "isFirstVariant": false,
    "variantCount": 3,
    "familyVariants": [
      "Loading01",
      "Loading02",
      "Loading03"
    ],
    "tags": [
      "loading",
      "loading02",
      "loading 02"
    ]
  },
  {
    "name": "Loading03",
    "label": "Loading 03",
    "category": "General",
    "baseFamily": "Loading",
    "isFirstVariant": false,
    "variantCount": 3,
    "familyVariants": [
      "Loading01",
      "Loading02",
      "Loading03"
    ],
    "tags": [
      "loading",
      "loading03",
      "loading 03"
    ]
  },
  {
    "name": "Lock01",
    "label": "Lock 01",
    "category": "Security",
    "baseFamily": "Lock",
    "isFirstVariant": true,
    "variantCount": 4,
    "familyVariants": [
      "Lock01",
      "Lock02",
      "Lock03",
      "Lock04"
    ],
    "tags": [
      "lock",
      "security",
      "private",
      "encrypted",
      "secure",
      "protect",
      "padlock",
      "lock01",
      "lock 01"
    ]
  },
  {
    "name": "Lock02",
    "label": "Lock 02",
    "category": "Security",
    "baseFamily": "Lock",
    "isFirstVariant": false,
    "variantCount": 4,
    "familyVariants": [
      "Lock01",
      "Lock02",
      "Lock03",
      "Lock04"
    ],
    "tags": [
      "lock",
      "security",
      "private",
      "encrypted",
      "secure",
      "protect",
      "lock02",
      "lock 02"
    ]
  },
  {
    "name": "Lock03",
    "label": "Lock 03",
    "category": "Security",
    "baseFamily": "Lock",
    "isFirstVariant": false,
    "variantCount": 4,
    "familyVariants": [
      "Lock01",
      "Lock02",
      "Lock03",
      "Lock04"
    ],
    "tags": [
      "lock",
      "security",
      "private",
      "encrypted",
      "secure",
      "protect",
      "lock03",
      "lock 03"
    ]
  },
  {
    "name": "Lock04",
    "label": "Lock 04",
    "category": "Security",
    "baseFamily": "Lock",
    "isFirstVariant": false,
    "variantCount": 4,
    "familyVariants": [
      "Lock01",
      "Lock02",
      "Lock03",
      "Lock04"
    ],
    "tags": [
      "lock",
      "security",
      "private",
      "encrypted",
      "secure",
      "protect",
      "lock04",
      "lock 04"
    ]
  },
  {
    "name": "LockKeyholeCircle",
    "label": "Lock Keyhole Circle",
    "category": "Security",
    "baseFamily": "LockKeyholeCircle",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "LockKeyholeCircle"
    ],
    "tags": [
      "lock",
      "keyhole",
      "circle",
      "lockkeyholecircle",
      "lock keyhole circle"
    ]
  },
  {
    "name": "LockKeyholeSquare",
    "label": "Lock Keyhole Square",
    "category": "Security",
    "baseFamily": "LockKeyholeSquare",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "LockKeyholeSquare"
    ],
    "tags": [
      "lock",
      "keyhole",
      "square",
      "lockkeyholesquare",
      "lock keyhole square"
    ]
  },
  {
    "name": "LockUnlocked01",
    "label": "Lock Unlocked 01",
    "category": "Security",
    "baseFamily": "LockUnlocked",
    "isFirstVariant": true,
    "variantCount": 4,
    "familyVariants": [
      "LockUnlocked01",
      "LockUnlocked02",
      "LockUnlocked03",
      "LockUnlocked04"
    ],
    "tags": [
      "lock",
      "unlocked",
      "open",
      "public",
      "accessible",
      "lockunlocked01",
      "lock unlocked 01",
      "lockunlocked"
    ]
  },
  {
    "name": "LockUnlocked02",
    "label": "Lock Unlocked 02",
    "category": "Security",
    "baseFamily": "LockUnlocked",
    "isFirstVariant": false,
    "variantCount": 4,
    "familyVariants": [
      "LockUnlocked01",
      "LockUnlocked02",
      "LockUnlocked03",
      "LockUnlocked04"
    ],
    "tags": [
      "lock",
      "unlocked",
      "lockunlocked02",
      "lock unlocked 02",
      "lockunlocked"
    ]
  },
  {
    "name": "LockUnlocked03",
    "label": "Lock Unlocked 03",
    "category": "Security",
    "baseFamily": "LockUnlocked",
    "isFirstVariant": false,
    "variantCount": 4,
    "familyVariants": [
      "LockUnlocked01",
      "LockUnlocked02",
      "LockUnlocked03",
      "LockUnlocked04"
    ],
    "tags": [
      "lock",
      "unlocked",
      "lockunlocked03",
      "lock unlocked 03",
      "lockunlocked"
    ]
  },
  {
    "name": "LockUnlocked04",
    "label": "Lock Unlocked 04",
    "category": "Security",
    "baseFamily": "LockUnlocked",
    "isFirstVariant": false,
    "variantCount": 4,
    "familyVariants": [
      "LockUnlocked01",
      "LockUnlocked02",
      "LockUnlocked03",
      "LockUnlocked04"
    ],
    "tags": [
      "lock",
      "unlocked",
      "lockunlocked04",
      "lock unlocked 04",
      "lockunlocked"
    ]
  },
  {
    "name": "LogIn01",
    "label": "Log In 01",
    "category": "General",
    "baseFamily": "LogIn",
    "isFirstVariant": true,
    "variantCount": 4,
    "familyVariants": [
      "LogIn01",
      "LogIn02",
      "LogIn03",
      "LogIn04"
    ],
    "tags": [
      "log",
      "in",
      "login01",
      "log in 01",
      "login"
    ]
  },
  {
    "name": "LogIn02",
    "label": "Log In 02",
    "category": "General",
    "baseFamily": "LogIn",
    "isFirstVariant": false,
    "variantCount": 4,
    "familyVariants": [
      "LogIn01",
      "LogIn02",
      "LogIn03",
      "LogIn04"
    ],
    "tags": [
      "log",
      "in",
      "login02",
      "log in 02",
      "login"
    ]
  },
  {
    "name": "LogIn03",
    "label": "Log In 03",
    "category": "General",
    "baseFamily": "LogIn",
    "isFirstVariant": false,
    "variantCount": 4,
    "familyVariants": [
      "LogIn01",
      "LogIn02",
      "LogIn03",
      "LogIn04"
    ],
    "tags": [
      "log",
      "in",
      "login03",
      "log in 03",
      "login"
    ]
  },
  {
    "name": "LogIn04",
    "label": "Log In 04",
    "category": "General",
    "baseFamily": "LogIn",
    "isFirstVariant": false,
    "variantCount": 4,
    "familyVariants": [
      "LogIn01",
      "LogIn02",
      "LogIn03",
      "LogIn04"
    ],
    "tags": [
      "log",
      "in",
      "login04",
      "log in 04",
      "login"
    ]
  },
  {
    "name": "LogOut01",
    "label": "Log Out 01",
    "category": "General",
    "baseFamily": "LogOut",
    "isFirstVariant": true,
    "variantCount": 4,
    "familyVariants": [
      "LogOut01",
      "LogOut02",
      "LogOut03",
      "LogOut04"
    ],
    "tags": [
      "log",
      "out",
      "logout01",
      "log out 01",
      "logout"
    ]
  },
  {
    "name": "LogOut02",
    "label": "Log Out 02",
    "category": "General",
    "baseFamily": "LogOut",
    "isFirstVariant": false,
    "variantCount": 4,
    "familyVariants": [
      "LogOut01",
      "LogOut02",
      "LogOut03",
      "LogOut04"
    ],
    "tags": [
      "log",
      "out",
      "logout02",
      "log out 02",
      "logout"
    ]
  },
  {
    "name": "LogOut03",
    "label": "Log Out 03",
    "category": "General",
    "baseFamily": "LogOut",
    "isFirstVariant": false,
    "variantCount": 4,
    "familyVariants": [
      "LogOut01",
      "LogOut02",
      "LogOut03",
      "LogOut04"
    ],
    "tags": [
      "log",
      "out",
      "logout03",
      "log out 03",
      "logout"
    ]
  },
  {
    "name": "LogOut04",
    "label": "Log Out 04",
    "category": "General",
    "baseFamily": "LogOut",
    "isFirstVariant": false,
    "variantCount": 4,
    "familyVariants": [
      "LogOut01",
      "LogOut02",
      "LogOut03",
      "LogOut04"
    ],
    "tags": [
      "log",
      "out",
      "logout04",
      "log out 04",
      "logout"
    ]
  },
  {
    "name": "Luggage01",
    "label": "Luggage 01",
    "category": "Maps & travel",
    "baseFamily": "Luggage",
    "isFirstVariant": true,
    "variantCount": 3,
    "familyVariants": [
      "Luggage01",
      "Luggage02",
      "Luggage03"
    ],
    "tags": [
      "luggage",
      "luggage01",
      "luggage 01"
    ]
  },
  {
    "name": "Luggage02",
    "label": "Luggage 02",
    "category": "Maps & travel",
    "baseFamily": "Luggage",
    "isFirstVariant": false,
    "variantCount": 3,
    "familyVariants": [
      "Luggage01",
      "Luggage02",
      "Luggage03"
    ],
    "tags": [
      "luggage",
      "luggage02",
      "luggage 02"
    ]
  },
  {
    "name": "Luggage03",
    "label": "Luggage 03",
    "category": "Maps & travel",
    "baseFamily": "Luggage",
    "isFirstVariant": false,
    "variantCount": 3,
    "familyVariants": [
      "Luggage01",
      "Luggage02",
      "Luggage03"
    ],
    "tags": [
      "luggage",
      "luggage03",
      "luggage 03"
    ]
  },
  {
    "name": "MagicWand01",
    "label": "Magic Wand 01",
    "category": "Images",
    "baseFamily": "MagicWand",
    "isFirstVariant": true,
    "variantCount": 2,
    "familyVariants": [
      "MagicWand01",
      "MagicWand02"
    ],
    "tags": [
      "magic",
      "wand",
      "magicwand01",
      "magic wand 01",
      "magicwand"
    ]
  },
  {
    "name": "MagicWand02",
    "label": "Magic Wand 02",
    "category": "Images",
    "baseFamily": "MagicWand",
    "isFirstVariant": false,
    "variantCount": 2,
    "familyVariants": [
      "MagicWand01",
      "MagicWand02"
    ],
    "tags": [
      "magic",
      "wand",
      "magicwand02",
      "magic wand 02",
      "magicwand"
    ]
  },
  {
    "name": "Mail01",
    "label": "Mail 01",
    "category": "Communication",
    "baseFamily": "Mail",
    "isFirstVariant": true,
    "variantCount": 5,
    "familyVariants": [
      "Mail01",
      "Mail02",
      "Mail03",
      "Mail04",
      "Mail05"
    ],
    "tags": [
      "mail",
      "mail01",
      "mail 01"
    ]
  },
  {
    "name": "Mail02",
    "label": "Mail 02",
    "category": "Communication",
    "baseFamily": "Mail",
    "isFirstVariant": false,
    "variantCount": 5,
    "familyVariants": [
      "Mail01",
      "Mail02",
      "Mail03",
      "Mail04",
      "Mail05"
    ],
    "tags": [
      "mail",
      "mail02",
      "mail 02"
    ]
  },
  {
    "name": "Mail03",
    "label": "Mail 03",
    "category": "Communication",
    "baseFamily": "Mail",
    "isFirstVariant": false,
    "variantCount": 5,
    "familyVariants": [
      "Mail01",
      "Mail02",
      "Mail03",
      "Mail04",
      "Mail05"
    ],
    "tags": [
      "mail",
      "mail03",
      "mail 03"
    ]
  },
  {
    "name": "Mail04",
    "label": "Mail 04",
    "category": "Communication",
    "baseFamily": "Mail",
    "isFirstVariant": false,
    "variantCount": 5,
    "familyVariants": [
      "Mail01",
      "Mail02",
      "Mail03",
      "Mail04",
      "Mail05"
    ],
    "tags": [
      "mail",
      "mail04",
      "mail 04"
    ]
  },
  {
    "name": "Mail05",
    "label": "Mail 05",
    "category": "Communication",
    "baseFamily": "Mail",
    "isFirstVariant": false,
    "variantCount": 5,
    "familyVariants": [
      "Mail01",
      "Mail02",
      "Mail03",
      "Mail04",
      "Mail05"
    ],
    "tags": [
      "mail",
      "mail05",
      "mail 05"
    ]
  },
  {
    "name": "Map01",
    "label": "Map 01",
    "category": "Maps & travel",
    "baseFamily": "Map",
    "isFirstVariant": true,
    "variantCount": 2,
    "familyVariants": [
      "Map01",
      "Map02"
    ],
    "tags": [
      "map",
      "map01",
      "map 01"
    ]
  },
  {
    "name": "Map02",
    "label": "Map 02",
    "category": "Maps & travel",
    "baseFamily": "Map",
    "isFirstVariant": false,
    "variantCount": 2,
    "familyVariants": [
      "Map01",
      "Map02"
    ],
    "tags": [
      "map",
      "map02",
      "map 02"
    ]
  },
  {
    "name": "Mark",
    "label": "Mark",
    "category": "General",
    "baseFamily": "Mark",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "Mark"
    ],
    "tags": [
      "mark"
    ]
  },
  {
    "name": "MarkerPin01",
    "label": "Marker Pin 01",
    "category": "Editor",
    "baseFamily": "MarkerPin",
    "isFirstVariant": true,
    "variantCount": 6,
    "familyVariants": [
      "MarkerPin01",
      "MarkerPin02",
      "MarkerPin03",
      "MarkerPin04",
      "MarkerPin05",
      "MarkerPin06"
    ],
    "tags": [
      "marker",
      "pin",
      "location",
      "place",
      "map",
      "gps",
      "address",
      "store",
      "destination",
      "markerpin01",
      "marker pin 01",
      "markerpin"
    ]
  },
  {
    "name": "MarkerPin02",
    "label": "Marker Pin 02",
    "category": "Editor",
    "baseFamily": "MarkerPin",
    "isFirstVariant": false,
    "variantCount": 6,
    "familyVariants": [
      "MarkerPin01",
      "MarkerPin02",
      "MarkerPin03",
      "MarkerPin04",
      "MarkerPin05",
      "MarkerPin06"
    ],
    "tags": [
      "marker",
      "pin",
      "location",
      "place",
      "map",
      "gps",
      "address",
      "destination",
      "markerpin02",
      "marker pin 02",
      "markerpin"
    ]
  },
  {
    "name": "MarkerPin03",
    "label": "Marker Pin 03",
    "category": "Editor",
    "baseFamily": "MarkerPin",
    "isFirstVariant": false,
    "variantCount": 6,
    "familyVariants": [
      "MarkerPin01",
      "MarkerPin02",
      "MarkerPin03",
      "MarkerPin04",
      "MarkerPin05",
      "MarkerPin06"
    ],
    "tags": [
      "marker",
      "pin",
      "markerpin03",
      "marker pin 03",
      "markerpin"
    ]
  },
  {
    "name": "MarkerPin04",
    "label": "Marker Pin 04",
    "category": "Editor",
    "baseFamily": "MarkerPin",
    "isFirstVariant": false,
    "variantCount": 6,
    "familyVariants": [
      "MarkerPin01",
      "MarkerPin02",
      "MarkerPin03",
      "MarkerPin04",
      "MarkerPin05",
      "MarkerPin06"
    ],
    "tags": [
      "marker",
      "pin",
      "markerpin04",
      "marker pin 04",
      "markerpin"
    ]
  },
  {
    "name": "MarkerPin05",
    "label": "Marker Pin 05",
    "category": "Editor",
    "baseFamily": "MarkerPin",
    "isFirstVariant": false,
    "variantCount": 6,
    "familyVariants": [
      "MarkerPin01",
      "MarkerPin02",
      "MarkerPin03",
      "MarkerPin04",
      "MarkerPin05",
      "MarkerPin06"
    ],
    "tags": [
      "marker",
      "pin",
      "markerpin05",
      "marker pin 05",
      "markerpin"
    ]
  },
  {
    "name": "MarkerPin06",
    "label": "Marker Pin 06",
    "category": "Editor",
    "baseFamily": "MarkerPin",
    "isFirstVariant": false,
    "variantCount": 6,
    "familyVariants": [
      "MarkerPin01",
      "MarkerPin02",
      "MarkerPin03",
      "MarkerPin04",
      "MarkerPin05",
      "MarkerPin06"
    ],
    "tags": [
      "marker",
      "pin",
      "markerpin06",
      "marker pin 06",
      "markerpin"
    ]
  },
  {
    "name": "Maximize01",
    "label": "Maximize 01",
    "category": "Arrows",
    "baseFamily": "Maximize",
    "isFirstVariant": true,
    "variantCount": 2,
    "familyVariants": [
      "Maximize01",
      "Maximize02"
    ],
    "tags": [
      "maximize",
      "maximize01",
      "maximize 01"
    ]
  },
  {
    "name": "Maximize02",
    "label": "Maximize 02",
    "category": "Arrows",
    "baseFamily": "Maximize",
    "isFirstVariant": false,
    "variantCount": 2,
    "familyVariants": [
      "Maximize01",
      "Maximize02"
    ],
    "tags": [
      "maximize",
      "maximize02",
      "maximize 02"
    ]
  },
  {
    "name": "MedicalCircle",
    "label": "Medical Circle",
    "category": "Alerts & feedback",
    "baseFamily": "MedicalCircle",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "MedicalCircle"
    ],
    "tags": [
      "medical",
      "circle",
      "medicine",
      "drugs",
      "pharmacy",
      "pills",
      "vitamins",
      "medication",
      "prescriptions",
      "medicalcircle",
      "medical circle"
    ]
  },
  {
    "name": "MedicalCross",
    "label": "Medical Cross",
    "category": "Alerts & feedback",
    "baseFamily": "MedicalCross",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "MedicalCross"
    ],
    "tags": [
      "medical",
      "cross",
      "health",
      "hospital",
      "clinic",
      "doctor",
      "treatment",
      "first aid",
      "pharmacy",
      "emergency",
      "medicalcross",
      "medical cross"
    ]
  },
  {
    "name": "MedicalSquare",
    "label": "Medical Square",
    "category": "Alerts & feedback",
    "baseFamily": "MedicalSquare",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "MedicalSquare"
    ],
    "tags": [
      "medical",
      "square",
      "first aid",
      "health",
      "clinic",
      "paramedic",
      "medicalsquare",
      "medical square"
    ]
  },
  {
    "name": "Menu01",
    "label": "Menu 01",
    "category": "Layout",
    "baseFamily": "Menu",
    "isFirstVariant": true,
    "variantCount": 5,
    "familyVariants": [
      "Menu01",
      "Menu02",
      "Menu03",
      "Menu04",
      "Menu05"
    ],
    "tags": [
      "menu",
      "menu01",
      "menu 01"
    ]
  },
  {
    "name": "Menu02",
    "label": "Menu 02",
    "category": "Layout",
    "baseFamily": "Menu",
    "isFirstVariant": false,
    "variantCount": 5,
    "familyVariants": [
      "Menu01",
      "Menu02",
      "Menu03",
      "Menu04",
      "Menu05"
    ],
    "tags": [
      "menu",
      "menu02",
      "menu 02"
    ]
  },
  {
    "name": "Menu03",
    "label": "Menu 03",
    "category": "Layout",
    "baseFamily": "Menu",
    "isFirstVariant": false,
    "variantCount": 5,
    "familyVariants": [
      "Menu01",
      "Menu02",
      "Menu03",
      "Menu04",
      "Menu05"
    ],
    "tags": [
      "menu",
      "menu03",
      "menu 03"
    ]
  },
  {
    "name": "Menu04",
    "label": "Menu 04",
    "category": "Layout",
    "baseFamily": "Menu",
    "isFirstVariant": false,
    "variantCount": 5,
    "familyVariants": [
      "Menu01",
      "Menu02",
      "Menu03",
      "Menu04",
      "Menu05"
    ],
    "tags": [
      "menu",
      "menu04",
      "menu 04"
    ]
  },
  {
    "name": "Menu05",
    "label": "Menu 05",
    "category": "Layout",
    "baseFamily": "Menu",
    "isFirstVariant": false,
    "variantCount": 5,
    "familyVariants": [
      "Menu01",
      "Menu02",
      "Menu03",
      "Menu04",
      "Menu05"
    ],
    "tags": [
      "menu",
      "menu05",
      "menu 05"
    ]
  },
  {
    "name": "MessageAlertCircle",
    "label": "Message Alert Circle",
    "category": "Communication",
    "baseFamily": "MessageAlertCircle",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "MessageAlertCircle"
    ],
    "tags": [
      "message",
      "alert",
      "circle",
      "messagealertcircle",
      "message alert circle"
    ]
  },
  {
    "name": "MessageAlertSquare",
    "label": "Message Alert Square",
    "category": "Communication",
    "baseFamily": "MessageAlertSquare",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "MessageAlertSquare"
    ],
    "tags": [
      "message",
      "alert",
      "square",
      "messagealertsquare",
      "message alert square"
    ]
  },
  {
    "name": "MessageChatCircle",
    "label": "Message Chat Circle",
    "category": "Communication",
    "baseFamily": "MessageChatCircle",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "MessageChatCircle"
    ],
    "tags": [
      "message",
      "chat",
      "circle",
      "messagechatcircle",
      "message chat circle"
    ]
  },
  {
    "name": "MessageChatSquare",
    "label": "Message Chat Square",
    "category": "Communication",
    "baseFamily": "MessageChatSquare",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "MessageChatSquare"
    ],
    "tags": [
      "message",
      "chat",
      "square",
      "messagechatsquare",
      "message chat square"
    ]
  },
  {
    "name": "MessageCheckCircle",
    "label": "Message Check Circle",
    "category": "Communication",
    "baseFamily": "MessageCheckCircle",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "MessageCheckCircle"
    ],
    "tags": [
      "message",
      "check",
      "circle",
      "messagecheckcircle",
      "message check circle"
    ]
  },
  {
    "name": "MessageCheckSquare",
    "label": "Message Check Square",
    "category": "Communication",
    "baseFamily": "MessageCheckSquare",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "MessageCheckSquare"
    ],
    "tags": [
      "message",
      "check",
      "square",
      "messagechecksquare",
      "message check square"
    ]
  },
  {
    "name": "MessageCircle01",
    "label": "Message Circle 01",
    "category": "Communication",
    "baseFamily": "MessageCircle",
    "isFirstVariant": true,
    "variantCount": 2,
    "familyVariants": [
      "MessageCircle01",
      "MessageCircle02"
    ],
    "tags": [
      "message",
      "circle",
      "messagecircle01",
      "message circle 01",
      "messagecircle"
    ]
  },
  {
    "name": "MessageCircle02",
    "label": "Message Circle 02",
    "category": "Communication",
    "baseFamily": "MessageCircle",
    "isFirstVariant": false,
    "variantCount": 2,
    "familyVariants": [
      "MessageCircle01",
      "MessageCircle02"
    ],
    "tags": [
      "message",
      "circle",
      "messagecircle02",
      "message circle 02",
      "messagecircle"
    ]
  },
  {
    "name": "MessageDotsCircle",
    "label": "Message Dots Circle",
    "category": "Communication",
    "baseFamily": "MessageDotsCircle",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "MessageDotsCircle"
    ],
    "tags": [
      "message",
      "dots",
      "circle",
      "messagedotscircle",
      "message dots circle"
    ]
  },
  {
    "name": "MessageDotsSquare",
    "label": "Message Dots Square",
    "category": "Communication",
    "baseFamily": "MessageDotsSquare",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "MessageDotsSquare"
    ],
    "tags": [
      "message",
      "dots",
      "square",
      "messagedotssquare",
      "message dots square"
    ]
  },
  {
    "name": "MessageHeartCircle",
    "label": "Message Heart Circle",
    "category": "Communication",
    "baseFamily": "MessageHeartCircle",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "MessageHeartCircle"
    ],
    "tags": [
      "message",
      "heart",
      "circle",
      "messageheartcircle",
      "message heart circle"
    ]
  },
  {
    "name": "MessageHeartSquare",
    "label": "Message Heart Square",
    "category": "Communication",
    "baseFamily": "MessageHeartSquare",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "MessageHeartSquare"
    ],
    "tags": [
      "message",
      "heart",
      "square",
      "messageheartsquare",
      "message heart square"
    ]
  },
  {
    "name": "MessageNotificationCircle",
    "label": "Message Notification Circle",
    "category": "Communication",
    "baseFamily": "MessageNotificationCircle",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "MessageNotificationCircle"
    ],
    "tags": [
      "message",
      "notification",
      "circle",
      "messagenotificationcircle",
      "message notification circle"
    ]
  },
  {
    "name": "MessageNotificationSquare",
    "label": "Message Notification Square",
    "category": "Communication",
    "baseFamily": "MessageNotificationSquare",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "MessageNotificationSquare"
    ],
    "tags": [
      "message",
      "notification",
      "square",
      "messagenotificationsquare",
      "message notification square"
    ]
  },
  {
    "name": "MessagePlusCircle",
    "label": "Message Plus Circle",
    "category": "Communication",
    "baseFamily": "MessagePlusCircle",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "MessagePlusCircle"
    ],
    "tags": [
      "message",
      "plus",
      "circle",
      "messagepluscircle",
      "message plus circle"
    ]
  },
  {
    "name": "MessagePlusSquare",
    "label": "Message Plus Square",
    "category": "Communication",
    "baseFamily": "MessagePlusSquare",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "MessagePlusSquare"
    ],
    "tags": [
      "message",
      "plus",
      "square",
      "messageplussquare",
      "message plus square"
    ]
  },
  {
    "name": "MessageQuestionCircle",
    "label": "Message Question Circle",
    "category": "Communication",
    "baseFamily": "MessageQuestionCircle",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "MessageQuestionCircle"
    ],
    "tags": [
      "message",
      "question",
      "circle",
      "messagequestioncircle",
      "message question circle"
    ]
  },
  {
    "name": "MessageQuestionSquare",
    "label": "Message Question Square",
    "category": "Communication",
    "baseFamily": "MessageQuestionSquare",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "MessageQuestionSquare"
    ],
    "tags": [
      "message",
      "question",
      "square",
      "messagequestionsquare",
      "message question square"
    ]
  },
  {
    "name": "MessageSmileCircle",
    "label": "Message Smile Circle",
    "category": "Communication",
    "baseFamily": "MessageSmileCircle",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "MessageSmileCircle"
    ],
    "tags": [
      "message",
      "smile",
      "circle",
      "messagesmilecircle",
      "message smile circle"
    ]
  },
  {
    "name": "MessageSmileSquare",
    "label": "Message Smile Square",
    "category": "Communication",
    "baseFamily": "MessageSmileSquare",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "MessageSmileSquare"
    ],
    "tags": [
      "message",
      "smile",
      "square",
      "messagesmilesquare",
      "message smile square"
    ]
  },
  {
    "name": "MessageSquare01",
    "label": "Message Square 01",
    "category": "Communication",
    "baseFamily": "MessageSquare",
    "isFirstVariant": true,
    "variantCount": 2,
    "familyVariants": [
      "MessageSquare01",
      "MessageSquare02"
    ],
    "tags": [
      "message",
      "square",
      "messagesquare01",
      "message square 01",
      "messagesquare"
    ]
  },
  {
    "name": "MessageSquare02",
    "label": "Message Square 02",
    "category": "Communication",
    "baseFamily": "MessageSquare",
    "isFirstVariant": false,
    "variantCount": 2,
    "familyVariants": [
      "MessageSquare01",
      "MessageSquare02"
    ],
    "tags": [
      "message",
      "square",
      "messagesquare02",
      "message square 02",
      "messagesquare"
    ]
  },
  {
    "name": "MessageTextCircle01",
    "label": "Message Text Circle 01",
    "category": "Communication",
    "baseFamily": "MessageTextCircle",
    "isFirstVariant": true,
    "variantCount": 2,
    "familyVariants": [
      "MessageTextCircle01",
      "MessageTextCircle02"
    ],
    "tags": [
      "message",
      "text",
      "circle",
      "messagetextcircle01",
      "message text circle 01",
      "messagetextcircle"
    ]
  },
  {
    "name": "MessageTextCircle02",
    "label": "Message Text Circle 02",
    "category": "Communication",
    "baseFamily": "MessageTextCircle",
    "isFirstVariant": false,
    "variantCount": 2,
    "familyVariants": [
      "MessageTextCircle01",
      "MessageTextCircle02"
    ],
    "tags": [
      "message",
      "text",
      "circle",
      "messagetextcircle02",
      "message text circle 02",
      "messagetextcircle"
    ]
  },
  {
    "name": "MessageTextSquare01",
    "label": "Message Text Square 01",
    "category": "Communication",
    "baseFamily": "MessageTextSquare",
    "isFirstVariant": true,
    "variantCount": 2,
    "familyVariants": [
      "MessageTextSquare01",
      "MessageTextSquare02"
    ],
    "tags": [
      "message",
      "text",
      "square",
      "messagetextsquare01",
      "message text square 01",
      "messagetextsquare"
    ]
  },
  {
    "name": "MessageTextSquare02",
    "label": "Message Text Square 02",
    "category": "Communication",
    "baseFamily": "MessageTextSquare",
    "isFirstVariant": false,
    "variantCount": 2,
    "familyVariants": [
      "MessageTextSquare01",
      "MessageTextSquare02"
    ],
    "tags": [
      "message",
      "text",
      "square",
      "messagetextsquare02",
      "message text square 02",
      "messagetextsquare"
    ]
  },
  {
    "name": "MessageXCircle",
    "label": "Message XCircle",
    "category": "Communication",
    "baseFamily": "MessageXCircle",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "MessageXCircle"
    ],
    "tags": [
      "message",
      "xcircle",
      "messagexcircle",
      "message xcircle"
    ]
  },
  {
    "name": "MessageXSquare",
    "label": "Message XSquare",
    "category": "Communication",
    "baseFamily": "MessageXSquare",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "MessageXSquare"
    ],
    "tags": [
      "message",
      "xsquare",
      "messagexsquare",
      "message xsquare"
    ]
  },
  {
    "name": "Microphone01",
    "label": "Microphone 01",
    "category": "Media & devices",
    "baseFamily": "Microphone",
    "isFirstVariant": true,
    "variantCount": 2,
    "familyVariants": [
      "Microphone01",
      "Microphone02"
    ],
    "tags": [
      "microphone",
      "microphone01",
      "microphone 01"
    ]
  },
  {
    "name": "Microphone02",
    "label": "Microphone 02",
    "category": "Media & devices",
    "baseFamily": "Microphone",
    "isFirstVariant": false,
    "variantCount": 2,
    "familyVariants": [
      "Microphone01",
      "Microphone02"
    ],
    "tags": [
      "microphone",
      "microphone02",
      "microphone 02"
    ]
  },
  {
    "name": "MicrophoneOff01",
    "label": "Microphone Off 01",
    "category": "Media & devices",
    "baseFamily": "MicrophoneOff",
    "isFirstVariant": true,
    "variantCount": 2,
    "familyVariants": [
      "MicrophoneOff01",
      "MicrophoneOff02"
    ],
    "tags": [
      "microphone",
      "off",
      "microphoneoff01",
      "microphone off 01",
      "microphoneoff"
    ]
  },
  {
    "name": "MicrophoneOff02",
    "label": "Microphone Off 02",
    "category": "Media & devices",
    "baseFamily": "MicrophoneOff",
    "isFirstVariant": false,
    "variantCount": 2,
    "familyVariants": [
      "MicrophoneOff01",
      "MicrophoneOff02"
    ],
    "tags": [
      "microphone",
      "off",
      "microphoneoff02",
      "microphone off 02",
      "microphoneoff"
    ]
  },
  {
    "name": "Microscope",
    "label": "Microscope",
    "category": "Media & devices",
    "baseFamily": "Microscope",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "Microscope"
    ],
    "tags": [
      "microscope"
    ]
  },
  {
    "name": "Minimize01",
    "label": "Minimize 01",
    "category": "Arrows",
    "baseFamily": "Minimize",
    "isFirstVariant": true,
    "variantCount": 2,
    "familyVariants": [
      "Minimize01",
      "Minimize02"
    ],
    "tags": [
      "minimize",
      "minimize01",
      "minimize 01"
    ]
  },
  {
    "name": "Minimize02",
    "label": "Minimize 02",
    "category": "Arrows",
    "baseFamily": "Minimize",
    "isFirstVariant": false,
    "variantCount": 2,
    "familyVariants": [
      "Minimize01",
      "Minimize02"
    ],
    "tags": [
      "minimize",
      "minimize02",
      "minimize 02"
    ]
  },
  {
    "name": "Minus",
    "label": "Minus",
    "category": "Alerts & feedback",
    "baseFamily": "Minus",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "Minus"
    ],
    "tags": [
      "minus"
    ]
  },
  {
    "name": "MinusCircle",
    "label": "Minus Circle",
    "category": "Alerts & feedback",
    "baseFamily": "MinusCircle",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "MinusCircle"
    ],
    "tags": [
      "minus",
      "circle",
      "minuscircle",
      "minus circle"
    ]
  },
  {
    "name": "MinusSquare",
    "label": "Minus Square",
    "category": "Alerts & feedback",
    "baseFamily": "MinusSquare",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "MinusSquare"
    ],
    "tags": [
      "minus",
      "square",
      "minussquare",
      "minus square"
    ]
  },
  {
    "name": "Modem01",
    "label": "Modem 01",
    "category": "Media & devices",
    "baseFamily": "Modem",
    "isFirstVariant": true,
    "variantCount": 2,
    "familyVariants": [
      "Modem01",
      "Modem02"
    ],
    "tags": [
      "modem",
      "modem01",
      "modem 01"
    ]
  },
  {
    "name": "Modem02",
    "label": "Modem 02",
    "category": "Media & devices",
    "baseFamily": "Modem",
    "isFirstVariant": false,
    "variantCount": 2,
    "familyVariants": [
      "Modem01",
      "Modem02"
    ],
    "tags": [
      "modem",
      "modem02",
      "modem 02"
    ]
  },
  {
    "name": "Monitor01",
    "label": "Monitor 01",
    "category": "Media & devices",
    "baseFamily": "Monitor",
    "isFirstVariant": true,
    "variantCount": 5,
    "familyVariants": [
      "Monitor01",
      "Monitor02",
      "Monitor03",
      "Monitor04",
      "Monitor05"
    ],
    "tags": [
      "monitor",
      "monitor01",
      "monitor 01"
    ]
  },
  {
    "name": "Monitor02",
    "label": "Monitor 02",
    "category": "Media & devices",
    "baseFamily": "Monitor",
    "isFirstVariant": false,
    "variantCount": 5,
    "familyVariants": [
      "Monitor01",
      "Monitor02",
      "Monitor03",
      "Monitor04",
      "Monitor05"
    ],
    "tags": [
      "monitor",
      "monitor02",
      "monitor 02"
    ]
  },
  {
    "name": "Monitor03",
    "label": "Monitor 03",
    "category": "Media & devices",
    "baseFamily": "Monitor",
    "isFirstVariant": false,
    "variantCount": 5,
    "familyVariants": [
      "Monitor01",
      "Monitor02",
      "Monitor03",
      "Monitor04",
      "Monitor05"
    ],
    "tags": [
      "monitor",
      "monitor03",
      "monitor 03"
    ]
  },
  {
    "name": "Monitor04",
    "label": "Monitor 04",
    "category": "Media & devices",
    "baseFamily": "Monitor",
    "isFirstVariant": false,
    "variantCount": 5,
    "familyVariants": [
      "Monitor01",
      "Monitor02",
      "Monitor03",
      "Monitor04",
      "Monitor05"
    ],
    "tags": [
      "monitor",
      "monitor04",
      "monitor 04"
    ]
  },
  {
    "name": "Monitor05",
    "label": "Monitor 05",
    "category": "Media & devices",
    "baseFamily": "Monitor",
    "isFirstVariant": false,
    "variantCount": 5,
    "familyVariants": [
      "Monitor01",
      "Monitor02",
      "Monitor03",
      "Monitor04",
      "Monitor05"
    ],
    "tags": [
      "monitor",
      "monitor05",
      "monitor 05"
    ]
  },
  {
    "name": "Moon01",
    "label": "Moon 01",
    "category": "Weather",
    "baseFamily": "Moon",
    "isFirstVariant": true,
    "variantCount": 2,
    "familyVariants": [
      "Moon01",
      "Moon02"
    ],
    "tags": [
      "moon",
      "night",
      "dark mode",
      "evening",
      "sleep",
      "bedtime",
      "moon01",
      "moon 01"
    ]
  },
  {
    "name": "Moon02",
    "label": "Moon 02",
    "category": "Weather",
    "baseFamily": "Moon",
    "isFirstVariant": false,
    "variantCount": 2,
    "familyVariants": [
      "Moon01",
      "Moon02"
    ],
    "tags": [
      "moon",
      "night",
      "dark mode",
      "evening",
      "sleep",
      "moon02",
      "moon 02"
    ]
  },
  {
    "name": "MoonEclipse",
    "label": "Moon Eclipse",
    "category": "Weather",
    "baseFamily": "MoonEclipse",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "MoonEclipse"
    ],
    "tags": [
      "moon",
      "eclipse",
      "mooneclipse",
      "moon eclipse"
    ]
  },
  {
    "name": "MoonStar",
    "label": "Moon Star",
    "category": "Weather",
    "baseFamily": "MoonStar",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "MoonStar"
    ],
    "tags": [
      "moon",
      "star",
      "moonstar",
      "moon star"
    ]
  },
  {
    "name": "Mouse",
    "label": "Mouse",
    "category": "Media & devices",
    "baseFamily": "Mouse",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "Mouse"
    ],
    "tags": [
      "mouse"
    ]
  },
  {
    "name": "Move",
    "label": "Move",
    "category": "General",
    "baseFamily": "Move",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "Move"
    ],
    "tags": [
      "move"
    ]
  },
  {
    "name": "MusicNote01",
    "label": "Music Note 01",
    "category": "Media & devices",
    "baseFamily": "MusicNote",
    "isFirstVariant": true,
    "variantCount": 2,
    "familyVariants": [
      "MusicNote01",
      "MusicNote02"
    ],
    "tags": [
      "music",
      "note",
      "spotify",
      "apple music",
      "audio",
      "concert",
      "song",
      "streaming",
      "track",
      "musicnote01",
      "music note 01",
      "musicnote"
    ]
  },
  {
    "name": "MusicNote02",
    "label": "Music Note 02",
    "category": "Media & devices",
    "baseFamily": "MusicNote",
    "isFirstVariant": false,
    "variantCount": 2,
    "familyVariants": [
      "MusicNote01",
      "MusicNote02"
    ],
    "tags": [
      "music",
      "note",
      "spotify",
      "apple music",
      "audio",
      "concert",
      "song",
      "streaming",
      "musicnote02",
      "music note 02",
      "musicnote"
    ]
  },
  {
    "name": "MusicNotePlus",
    "label": "Music Note Plus",
    "category": "Media & devices",
    "baseFamily": "MusicNotePlus",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "MusicNotePlus"
    ],
    "tags": [
      "music",
      "note",
      "plus",
      "musicnoteplus",
      "music note plus"
    ]
  },
  {
    "name": "NavigationPointer01",
    "label": "Navigation Pointer 01",
    "category": "Maps & travel",
    "baseFamily": "NavigationPointer",
    "isFirstVariant": true,
    "variantCount": 2,
    "familyVariants": [
      "NavigationPointer01",
      "NavigationPointer02"
    ],
    "tags": [
      "navigation",
      "pointer",
      "navigationpointer01",
      "navigation pointer 01",
      "navigationpointer"
    ]
  },
  {
    "name": "NavigationPointer02",
    "label": "Navigation Pointer 02",
    "category": "Maps & travel",
    "baseFamily": "NavigationPointer",
    "isFirstVariant": false,
    "variantCount": 2,
    "familyVariants": [
      "NavigationPointer01",
      "NavigationPointer02"
    ],
    "tags": [
      "navigation",
      "pointer",
      "navigationpointer02",
      "navigation pointer 02",
      "navigationpointer"
    ]
  },
  {
    "name": "NavigationPointerOff01",
    "label": "Navigation Pointer Off 01",
    "category": "Maps & travel",
    "baseFamily": "NavigationPointerOff",
    "isFirstVariant": true,
    "variantCount": 2,
    "familyVariants": [
      "NavigationPointerOff01",
      "NavigationPointerOff02"
    ],
    "tags": [
      "navigation",
      "pointer",
      "off",
      "navigationpointeroff01",
      "navigation pointer off 01",
      "navigationpointeroff"
    ]
  },
  {
    "name": "NavigationPointerOff02",
    "label": "Navigation Pointer Off 02",
    "category": "Maps & travel",
    "baseFamily": "NavigationPointerOff",
    "isFirstVariant": false,
    "variantCount": 2,
    "familyVariants": [
      "NavigationPointerOff01",
      "NavigationPointerOff02"
    ],
    "tags": [
      "navigation",
      "pointer",
      "off",
      "navigationpointeroff02",
      "navigation pointer off 02",
      "navigationpointeroff"
    ]
  },
  {
    "name": "NotificationBox",
    "label": "Notification Box",
    "category": "Communication",
    "baseFamily": "NotificationBox",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "NotificationBox"
    ],
    "tags": [
      "notification",
      "box",
      "notificationbox",
      "notification box"
    ]
  },
  {
    "name": "NotificationMessage",
    "label": "Notification Message",
    "category": "Communication",
    "baseFamily": "NotificationMessage",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "NotificationMessage"
    ],
    "tags": [
      "notification",
      "message",
      "notificationmessage",
      "notification message"
    ]
  },
  {
    "name": "NotificationText",
    "label": "Notification Text",
    "category": "Communication",
    "baseFamily": "NotificationText",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "NotificationText"
    ],
    "tags": [
      "notification",
      "text",
      "notificationtext",
      "notification text"
    ]
  },
  {
    "name": "Octagon",
    "label": "Octagon",
    "category": "Shapes",
    "baseFamily": "Octagon",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "Octagon"
    ],
    "tags": [
      "octagon"
    ]
  },
  {
    "name": "Package",
    "label": "Package",
    "category": "Development",
    "baseFamily": "Package",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "Package"
    ],
    "tags": [
      "package"
    ]
  },
  {
    "name": "PackageCheck",
    "label": "Package Check",
    "category": "Development",
    "baseFamily": "PackageCheck",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "PackageCheck"
    ],
    "tags": [
      "package",
      "check",
      "packagecheck",
      "package check"
    ]
  },
  {
    "name": "PackageMinus",
    "label": "Package Minus",
    "category": "Development",
    "baseFamily": "PackageMinus",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "PackageMinus"
    ],
    "tags": [
      "package",
      "minus",
      "packageminus",
      "package minus"
    ]
  },
  {
    "name": "PackagePlus",
    "label": "Package Plus",
    "category": "Development",
    "baseFamily": "PackagePlus",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "PackagePlus"
    ],
    "tags": [
      "package",
      "plus",
      "packageplus",
      "package plus"
    ]
  },
  {
    "name": "PackageSearch",
    "label": "Package Search",
    "category": "Development",
    "baseFamily": "PackageSearch",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "PackageSearch"
    ],
    "tags": [
      "package",
      "search",
      "packagesearch",
      "package search"
    ]
  },
  {
    "name": "PackageX",
    "label": "Package X",
    "category": "Development",
    "baseFamily": "PackageX",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "PackageX"
    ],
    "tags": [
      "package",
      "x",
      "packagex",
      "package x"
    ]
  },
  {
    "name": "Paint",
    "label": "Paint",
    "category": "Images",
    "baseFamily": "Paint",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "Paint"
    ],
    "tags": [
      "paint"
    ]
  },
  {
    "name": "PaintPour",
    "label": "Paint Pour",
    "category": "Images",
    "baseFamily": "PaintPour",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "PaintPour"
    ],
    "tags": [
      "paint",
      "pour",
      "paintpour",
      "paint pour"
    ]
  },
  {
    "name": "Palette",
    "label": "Palette",
    "category": "Images",
    "baseFamily": "Palette",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "Palette"
    ],
    "tags": [
      "palette"
    ]
  },
  {
    "name": "Paperclip",
    "label": "Paperclip",
    "category": "Files",
    "baseFamily": "Paperclip",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "Paperclip"
    ],
    "tags": [
      "paperclip"
    ]
  },
  {
    "name": "ParagraphSpacing",
    "label": "Paragraph Spacing",
    "category": "Editor",
    "baseFamily": "ParagraphSpacing",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "ParagraphSpacing"
    ],
    "tags": [
      "paragraph",
      "spacing",
      "paragraphspacing",
      "paragraph spacing"
    ]
  },
  {
    "name": "ParagraphWrap",
    "label": "Paragraph Wrap",
    "category": "Editor",
    "baseFamily": "ParagraphWrap",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "ParagraphWrap"
    ],
    "tags": [
      "paragraph",
      "wrap",
      "paragraphwrap",
      "paragraph wrap"
    ]
  },
  {
    "name": "Passcode",
    "label": "Passcode",
    "category": "Security",
    "baseFamily": "Passcode",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "Passcode"
    ],
    "tags": [
      "passcode",
      "pin",
      "badge",
      "security",
      "credentials",
      "auth"
    ]
  },
  {
    "name": "PasscodeLock",
    "label": "Passcode Lock",
    "category": "Security",
    "baseFamily": "PasscodeLock",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "PasscodeLock"
    ],
    "tags": [
      "passcode",
      "lock",
      "passcodelock",
      "passcode lock"
    ]
  },
  {
    "name": "Passport",
    "label": "Passport",
    "category": "Users",
    "baseFamily": "Passport",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "Passport"
    ],
    "tags": [
      "passport"
    ]
  },
  {
    "name": "PauseCircle",
    "label": "Pause Circle",
    "category": "General",
    "baseFamily": "PauseCircle",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "PauseCircle"
    ],
    "tags": [
      "pause",
      "circle",
      "pausecircle",
      "pause circle"
    ]
  },
  {
    "name": "PauseSquare",
    "label": "Pause Square",
    "category": "General",
    "baseFamily": "PauseSquare",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "PauseSquare"
    ],
    "tags": [
      "pause",
      "square",
      "pausesquare",
      "pause square"
    ]
  },
  {
    "name": "PenTool01",
    "label": "Pen Tool 01",
    "category": "Editor",
    "baseFamily": "PenTool",
    "isFirstVariant": true,
    "variantCount": 2,
    "familyVariants": [
      "PenTool01",
      "PenTool02"
    ],
    "tags": [
      "pen",
      "tool",
      "pentool01",
      "pen tool 01",
      "pentool"
    ]
  },
  {
    "name": "PenTool02",
    "label": "Pen Tool 02",
    "category": "Editor",
    "baseFamily": "PenTool",
    "isFirstVariant": false,
    "variantCount": 2,
    "familyVariants": [
      "PenTool01",
      "PenTool02"
    ],
    "tags": [
      "pen",
      "tool",
      "pentool02",
      "pen tool 02",
      "pentool"
    ]
  },
  {
    "name": "PenToolMinus",
    "label": "Pen Tool Minus",
    "category": "Editor",
    "baseFamily": "PenToolMinus",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "PenToolMinus"
    ],
    "tags": [
      "pen",
      "tool",
      "minus",
      "pentoolminus",
      "pen tool minus"
    ]
  },
  {
    "name": "PenToolPlus",
    "label": "Pen Tool Plus",
    "category": "Editor",
    "baseFamily": "PenToolPlus",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "PenToolPlus"
    ],
    "tags": [
      "pen",
      "tool",
      "plus",
      "pentoolplus",
      "pen tool plus"
    ]
  },
  {
    "name": "Pencil01",
    "label": "Pencil 01",
    "category": "Editor",
    "baseFamily": "Pencil",
    "isFirstVariant": true,
    "variantCount": 2,
    "familyVariants": [
      "Pencil01",
      "Pencil02"
    ],
    "tags": [
      "pencil",
      "pencil01",
      "pencil 01"
    ]
  },
  {
    "name": "Pencil02",
    "label": "Pencil 02",
    "category": "Editor",
    "baseFamily": "Pencil",
    "isFirstVariant": false,
    "variantCount": 2,
    "familyVariants": [
      "Pencil01",
      "Pencil02"
    ],
    "tags": [
      "pencil",
      "pencil02",
      "pencil 02"
    ]
  },
  {
    "name": "PencilLine",
    "label": "Pencil Line",
    "category": "Editor",
    "baseFamily": "PencilLine",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "PencilLine"
    ],
    "tags": [
      "pencil",
      "line",
      "pencilline",
      "pencil line"
    ]
  },
  {
    "name": "Pentagon",
    "label": "Pentagon",
    "category": "Editor",
    "baseFamily": "Pentagon",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "Pentagon"
    ],
    "tags": [
      "pentagon"
    ]
  },
  {
    "name": "Percent01",
    "label": "Percent 01",
    "category": "Finance & eCommerce",
    "baseFamily": "Percent",
    "isFirstVariant": true,
    "variantCount": 3,
    "familyVariants": [
      "Percent01",
      "Percent02",
      "Percent03"
    ],
    "tags": [
      "percent",
      "percent01",
      "percent 01"
    ]
  },
  {
    "name": "Percent02",
    "label": "Percent 02",
    "category": "Finance & eCommerce",
    "baseFamily": "Percent",
    "isFirstVariant": false,
    "variantCount": 3,
    "familyVariants": [
      "Percent01",
      "Percent02",
      "Percent03"
    ],
    "tags": [
      "percent",
      "percent02",
      "percent 02"
    ]
  },
  {
    "name": "Percent03",
    "label": "Percent 03",
    "category": "Finance & eCommerce",
    "baseFamily": "Percent",
    "isFirstVariant": false,
    "variantCount": 3,
    "familyVariants": [
      "Percent01",
      "Percent02",
      "Percent03"
    ],
    "tags": [
      "percent",
      "percent03",
      "percent 03"
    ]
  },
  {
    "name": "Perspective01",
    "label": "Perspective 01",
    "category": "Images",
    "baseFamily": "Perspective",
    "isFirstVariant": true,
    "variantCount": 2,
    "familyVariants": [
      "Perspective01",
      "Perspective02"
    ],
    "tags": [
      "perspective",
      "perspective01",
      "perspective 01"
    ]
  },
  {
    "name": "Perspective02",
    "label": "Perspective 02",
    "category": "Images",
    "baseFamily": "Perspective",
    "isFirstVariant": false,
    "variantCount": 2,
    "familyVariants": [
      "Perspective01",
      "Perspective02"
    ],
    "tags": [
      "perspective",
      "perspective02",
      "perspective 02"
    ]
  },
  {
    "name": "Phone",
    "label": "Phone",
    "category": "Communication",
    "baseFamily": "Phone",
    "isFirstVariant": false,
    "variantCount": 3,
    "familyVariants": [
      "Phone",
      "Phone01",
      "Phone02"
    ],
    "tags": [
      "phone"
    ]
  },
  {
    "name": "Phone01",
    "label": "Phone 01",
    "category": "Communication",
    "baseFamily": "Phone",
    "isFirstVariant": true,
    "variantCount": 3,
    "familyVariants": [
      "Phone",
      "Phone01",
      "Phone02"
    ],
    "tags": [
      "phone",
      "phone01",
      "phone 01"
    ]
  },
  {
    "name": "Phone02",
    "label": "Phone 02",
    "category": "Communication",
    "baseFamily": "Phone",
    "isFirstVariant": false,
    "variantCount": 3,
    "familyVariants": [
      "Phone",
      "Phone01",
      "Phone02"
    ],
    "tags": [
      "phone",
      "phone02",
      "phone 02"
    ]
  },
  {
    "name": "PhoneCall01",
    "label": "Phone Call 01",
    "category": "Communication",
    "baseFamily": "PhoneCall",
    "isFirstVariant": true,
    "variantCount": 2,
    "familyVariants": [
      "PhoneCall01",
      "PhoneCall02"
    ],
    "tags": [
      "phone",
      "call",
      "phonecall01",
      "phone call 01",
      "phonecall"
    ]
  },
  {
    "name": "PhoneCall02",
    "label": "Phone Call 02",
    "category": "Communication",
    "baseFamily": "PhoneCall",
    "isFirstVariant": false,
    "variantCount": 2,
    "familyVariants": [
      "PhoneCall01",
      "PhoneCall02"
    ],
    "tags": [
      "phone",
      "call",
      "phonecall02",
      "phone call 02",
      "phonecall"
    ]
  },
  {
    "name": "PhoneHangUp",
    "label": "Phone Hang Up",
    "category": "Communication",
    "baseFamily": "PhoneHangUp",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "PhoneHangUp"
    ],
    "tags": [
      "phone",
      "hang",
      "up",
      "phonehangup",
      "phone hang up"
    ]
  },
  {
    "name": "PhoneIncoming01",
    "label": "Phone Incoming 01",
    "category": "Communication",
    "baseFamily": "PhoneIncoming",
    "isFirstVariant": true,
    "variantCount": 2,
    "familyVariants": [
      "PhoneIncoming01",
      "PhoneIncoming02"
    ],
    "tags": [
      "phone",
      "incoming",
      "phoneincoming01",
      "phone incoming 01",
      "phoneincoming"
    ]
  },
  {
    "name": "PhoneIncoming02",
    "label": "Phone Incoming 02",
    "category": "Communication",
    "baseFamily": "PhoneIncoming",
    "isFirstVariant": false,
    "variantCount": 2,
    "familyVariants": [
      "PhoneIncoming01",
      "PhoneIncoming02"
    ],
    "tags": [
      "phone",
      "incoming",
      "phoneincoming02",
      "phone incoming 02",
      "phoneincoming"
    ]
  },
  {
    "name": "PhoneOutgoing01",
    "label": "Phone Outgoing 01",
    "category": "Communication",
    "baseFamily": "PhoneOutgoing",
    "isFirstVariant": true,
    "variantCount": 2,
    "familyVariants": [
      "PhoneOutgoing01",
      "PhoneOutgoing02"
    ],
    "tags": [
      "phone",
      "outgoing",
      "phoneoutgoing01",
      "phone outgoing 01",
      "phoneoutgoing"
    ]
  },
  {
    "name": "PhoneOutgoing02",
    "label": "Phone Outgoing 02",
    "category": "Communication",
    "baseFamily": "PhoneOutgoing",
    "isFirstVariant": false,
    "variantCount": 2,
    "familyVariants": [
      "PhoneOutgoing01",
      "PhoneOutgoing02"
    ],
    "tags": [
      "phone",
      "outgoing",
      "phoneoutgoing02",
      "phone outgoing 02",
      "phoneoutgoing"
    ]
  },
  {
    "name": "PhonePause",
    "label": "Phone Pause",
    "category": "Communication",
    "baseFamily": "PhonePause",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "PhonePause"
    ],
    "tags": [
      "phone",
      "pause",
      "phonepause",
      "phone pause"
    ]
  },
  {
    "name": "PhonePlus",
    "label": "Phone Plus",
    "category": "Communication",
    "baseFamily": "PhonePlus",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "PhonePlus"
    ],
    "tags": [
      "phone",
      "plus",
      "phoneplus",
      "phone plus"
    ]
  },
  {
    "name": "PhoneX",
    "label": "Phone X",
    "category": "Communication",
    "baseFamily": "PhoneX",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "PhoneX"
    ],
    "tags": [
      "phone",
      "x",
      "phonex",
      "phone x"
    ]
  },
  {
    "name": "PieChart01",
    "label": "Pie Chart 01",
    "category": "Charts",
    "baseFamily": "PieChart",
    "isFirstVariant": true,
    "variantCount": 4,
    "familyVariants": [
      "PieChart01",
      "PieChart02",
      "PieChart03",
      "PieChart04"
    ],
    "tags": [
      "pie",
      "chart",
      "allocation",
      "distribution",
      "budget",
      "portfolio",
      "breakdown",
      "shares",
      "piechart01",
      "pie chart 01",
      "piechart"
    ]
  },
  {
    "name": "PieChart02",
    "label": "Pie Chart 02",
    "category": "Charts",
    "baseFamily": "PieChart",
    "isFirstVariant": false,
    "variantCount": 4,
    "familyVariants": [
      "PieChart01",
      "PieChart02",
      "PieChart03",
      "PieChart04"
    ],
    "tags": [
      "pie",
      "chart",
      "allocation",
      "distribution",
      "budget",
      "portfolio",
      "breakdown",
      "piechart02",
      "pie chart 02",
      "piechart"
    ]
  },
  {
    "name": "PieChart03",
    "label": "Pie Chart 03",
    "category": "Charts",
    "baseFamily": "PieChart",
    "isFirstVariant": false,
    "variantCount": 4,
    "familyVariants": [
      "PieChart01",
      "PieChart02",
      "PieChart03",
      "PieChart04"
    ],
    "tags": [
      "pie",
      "chart",
      "piechart03",
      "pie chart 03",
      "piechart"
    ]
  },
  {
    "name": "PieChart04",
    "label": "Pie Chart 04",
    "category": "Charts",
    "baseFamily": "PieChart",
    "isFirstVariant": false,
    "variantCount": 4,
    "familyVariants": [
      "PieChart01",
      "PieChart02",
      "PieChart03",
      "PieChart04"
    ],
    "tags": [
      "pie",
      "chart",
      "piechart04",
      "pie chart 04",
      "piechart"
    ]
  },
  {
    "name": "PiggyBank01",
    "label": "Piggy Bank 01",
    "category": "Finance & eCommerce",
    "baseFamily": "PiggyBank",
    "isFirstVariant": true,
    "variantCount": 2,
    "familyVariants": [
      "PiggyBank01",
      "PiggyBank02"
    ],
    "tags": [
      "piggy",
      "bank",
      "savings",
      "deposit",
      "emergency fund",
      "budget",
      "save",
      "money box",
      "nest egg",
      "piggybank01",
      "piggy bank 01",
      "piggybank"
    ]
  },
  {
    "name": "PiggyBank02",
    "label": "Piggy Bank 02",
    "category": "Finance & eCommerce",
    "baseFamily": "PiggyBank",
    "isFirstVariant": false,
    "variantCount": 2,
    "familyVariants": [
      "PiggyBank01",
      "PiggyBank02"
    ],
    "tags": [
      "piggy",
      "bank",
      "savings",
      "deposit",
      "emergency fund",
      "budget",
      "save",
      "money box",
      "nest egg",
      "piggybank02",
      "piggy bank 02",
      "piggybank"
    ]
  },
  {
    "name": "Pilcrow01",
    "label": "Pilcrow 01",
    "category": "General",
    "baseFamily": "Pilcrow",
    "isFirstVariant": true,
    "variantCount": 2,
    "familyVariants": [
      "Pilcrow01",
      "Pilcrow02"
    ],
    "tags": [
      "pilcrow",
      "pilcrow01",
      "pilcrow 01"
    ]
  },
  {
    "name": "Pilcrow02",
    "label": "Pilcrow 02",
    "category": "General",
    "baseFamily": "Pilcrow",
    "isFirstVariant": false,
    "variantCount": 2,
    "familyVariants": [
      "Pilcrow01",
      "Pilcrow02"
    ],
    "tags": [
      "pilcrow",
      "pilcrow02",
      "pilcrow 02"
    ]
  },
  {
    "name": "PilcrowSquare",
    "label": "Pilcrow Square",
    "category": "General",
    "baseFamily": "PilcrowSquare",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "PilcrowSquare"
    ],
    "tags": [
      "pilcrow",
      "square",
      "pilcrowsquare",
      "pilcrow square"
    ]
  },
  {
    "name": "Pin01",
    "label": "Pin 01",
    "category": "General",
    "baseFamily": "Pin",
    "isFirstVariant": true,
    "variantCount": 2,
    "familyVariants": [
      "Pin01",
      "Pin02"
    ],
    "tags": [
      "pin",
      "pin01",
      "pin 01"
    ]
  },
  {
    "name": "Pin02",
    "label": "Pin 02",
    "category": "General",
    "baseFamily": "Pin",
    "isFirstVariant": false,
    "variantCount": 2,
    "familyVariants": [
      "Pin01",
      "Pin02"
    ],
    "tags": [
      "pin",
      "pin02",
      "pin 02"
    ]
  },
  {
    "name": "Placeholder",
    "label": "Placeholder",
    "category": "General",
    "baseFamily": "Placeholder",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "Placeholder"
    ],
    "tags": [
      "placeholder"
    ]
  },
  {
    "name": "Plane",
    "label": "Plane",
    "category": "Maps & travel",
    "baseFamily": "Plane",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "Plane"
    ],
    "tags": [
      "plane",
      "flight",
      "airline",
      "vacation",
      "trip",
      "travel",
      "holiday",
      "airport"
    ]
  },
  {
    "name": "Play",
    "label": "Play",
    "category": "General",
    "baseFamily": "Play",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "Play"
    ],
    "tags": [
      "play"
    ]
  },
  {
    "name": "PlayCircle",
    "label": "Play Circle",
    "category": "General",
    "baseFamily": "PlayCircle",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "PlayCircle"
    ],
    "tags": [
      "play",
      "circle",
      "playcircle",
      "play circle"
    ]
  },
  {
    "name": "PlaySquare",
    "label": "Play Square",
    "category": "General",
    "baseFamily": "PlaySquare",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "PlaySquare"
    ],
    "tags": [
      "play",
      "square",
      "playsquare",
      "play square"
    ]
  },
  {
    "name": "Plus",
    "label": "Plus",
    "category": "Alerts & feedback",
    "baseFamily": "Plus",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "Plus"
    ],
    "tags": [
      "plus"
    ]
  },
  {
    "name": "PlusCircle",
    "label": "Plus Circle",
    "category": "Alerts & feedback",
    "baseFamily": "PlusCircle",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "PlusCircle"
    ],
    "tags": [
      "plus",
      "circle",
      "pluscircle",
      "plus circle"
    ]
  },
  {
    "name": "PlusSquare",
    "label": "Plus Square",
    "category": "Alerts & feedback",
    "baseFamily": "PlusSquare",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "PlusSquare"
    ],
    "tags": [
      "plus",
      "square",
      "plussquare",
      "plus square"
    ]
  },
  {
    "name": "Podcast",
    "label": "Podcast",
    "category": "Media & devices",
    "baseFamily": "Podcast",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "Podcast"
    ],
    "tags": [
      "podcast"
    ]
  },
  {
    "name": "Power01",
    "label": "Power 01",
    "category": "General",
    "baseFamily": "Power",
    "isFirstVariant": true,
    "variantCount": 3,
    "familyVariants": [
      "Power01",
      "Power02",
      "Power03"
    ],
    "tags": [
      "power",
      "power01",
      "power 01"
    ]
  },
  {
    "name": "Power02",
    "label": "Power 02",
    "category": "General",
    "baseFamily": "Power",
    "isFirstVariant": false,
    "variantCount": 3,
    "familyVariants": [
      "Power01",
      "Power02",
      "Power03"
    ],
    "tags": [
      "power",
      "power02",
      "power 02"
    ]
  },
  {
    "name": "Power03",
    "label": "Power 03",
    "category": "General",
    "baseFamily": "Power",
    "isFirstVariant": false,
    "variantCount": 3,
    "familyVariants": [
      "Power01",
      "Power02",
      "Power03"
    ],
    "tags": [
      "power",
      "power03",
      "power 03"
    ]
  },
  {
    "name": "PresentationChart01",
    "label": "Presentation Chart 01",
    "category": "Charts",
    "baseFamily": "PresentationChart",
    "isFirstVariant": true,
    "variantCount": 3,
    "familyVariants": [
      "PresentationChart01",
      "PresentationChart02",
      "PresentationChart03"
    ],
    "tags": [
      "presentation",
      "chart",
      "presentationchart01",
      "presentation chart 01",
      "presentationchart"
    ]
  },
  {
    "name": "PresentationChart02",
    "label": "Presentation Chart 02",
    "category": "Charts",
    "baseFamily": "PresentationChart",
    "isFirstVariant": false,
    "variantCount": 3,
    "familyVariants": [
      "PresentationChart01",
      "PresentationChart02",
      "PresentationChart03"
    ],
    "tags": [
      "presentation",
      "chart",
      "presentationchart02",
      "presentation chart 02",
      "presentationchart"
    ]
  },
  {
    "name": "PresentationChart03",
    "label": "Presentation Chart 03",
    "category": "Charts",
    "baseFamily": "PresentationChart",
    "isFirstVariant": false,
    "variantCount": 3,
    "familyVariants": [
      "PresentationChart01",
      "PresentationChart02",
      "PresentationChart03"
    ],
    "tags": [
      "presentation",
      "chart",
      "presentationchart03",
      "presentation chart 03",
      "presentationchart"
    ]
  },
  {
    "name": "Printer",
    "label": "Printer",
    "category": "Media & devices",
    "baseFamily": "Printer",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "Printer"
    ],
    "tags": [
      "printer"
    ]
  },
  {
    "name": "PuzzlePiece01",
    "label": "Puzzle Piece 01",
    "category": "Development",
    "baseFamily": "PuzzlePiece",
    "isFirstVariant": true,
    "variantCount": 2,
    "familyVariants": [
      "PuzzlePiece01",
      "PuzzlePiece02"
    ],
    "tags": [
      "puzzle",
      "piece",
      "puzzlepiece01",
      "puzzle piece 01",
      "puzzlepiece"
    ]
  },
  {
    "name": "PuzzlePiece02",
    "label": "Puzzle Piece 02",
    "category": "Development",
    "baseFamily": "PuzzlePiece",
    "isFirstVariant": false,
    "variantCount": 2,
    "familyVariants": [
      "PuzzlePiece01",
      "PuzzlePiece02"
    ],
    "tags": [
      "puzzle",
      "piece",
      "puzzlepiece02",
      "puzzle piece 02",
      "puzzlepiece"
    ]
  },
  {
    "name": "QrCode01",
    "label": "Qr Code 01",
    "category": "General",
    "baseFamily": "QrCode",
    "isFirstVariant": true,
    "variantCount": 2,
    "familyVariants": [
      "QrCode01",
      "QrCode02"
    ],
    "tags": [
      "qr",
      "code",
      "qrcode01",
      "qr code 01",
      "qrcode"
    ]
  },
  {
    "name": "QrCode02",
    "label": "Qr Code 02",
    "category": "General",
    "baseFamily": "QrCode",
    "isFirstVariant": false,
    "variantCount": 2,
    "familyVariants": [
      "QrCode01",
      "QrCode02"
    ],
    "tags": [
      "qr",
      "code",
      "qrcode02",
      "qr code 02",
      "qrcode"
    ]
  },
  {
    "name": "Receipt",
    "label": "Receipt",
    "category": "Finance & eCommerce",
    "baseFamily": "Receipt",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "Receipt"
    ],
    "tags": [
      "receipt",
      "invoice",
      "bill",
      "transaction",
      "tax",
      "slip",
      "proof",
      "expense",
      "receipts"
    ]
  },
  {
    "name": "ReceiptCheck",
    "label": "Receipt Check",
    "category": "Finance & eCommerce",
    "baseFamily": "ReceiptCheck",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "ReceiptCheck"
    ],
    "tags": [
      "receipt",
      "check",
      "paid bill",
      "cleared receipt",
      "settled",
      "verified",
      "audit",
      "receiptcheck",
      "receipt check"
    ]
  },
  {
    "name": "Recording01",
    "label": "Recording 01",
    "category": "Media & devices",
    "baseFamily": "Recording",
    "isFirstVariant": true,
    "variantCount": 3,
    "familyVariants": [
      "Recording01",
      "Recording02",
      "Recording03"
    ],
    "tags": [
      "recording",
      "recording01",
      "recording 01"
    ]
  },
  {
    "name": "Recording02",
    "label": "Recording 02",
    "category": "Media & devices",
    "baseFamily": "Recording",
    "isFirstVariant": false,
    "variantCount": 3,
    "familyVariants": [
      "Recording01",
      "Recording02",
      "Recording03"
    ],
    "tags": [
      "recording",
      "recording02",
      "recording 02"
    ]
  },
  {
    "name": "Recording03",
    "label": "Recording 03",
    "category": "Media & devices",
    "baseFamily": "Recording",
    "isFirstVariant": false,
    "variantCount": 3,
    "familyVariants": [
      "Recording01",
      "Recording02",
      "Recording03"
    ],
    "tags": [
      "recording",
      "recording03",
      "recording 03"
    ]
  },
  {
    "name": "Reflect01",
    "label": "Reflect 01",
    "category": "General",
    "baseFamily": "Reflect",
    "isFirstVariant": true,
    "variantCount": 2,
    "familyVariants": [
      "Reflect01",
      "Reflect02"
    ],
    "tags": [
      "reflect",
      "reflect01",
      "reflect 01"
    ]
  },
  {
    "name": "Reflect02",
    "label": "Reflect 02",
    "category": "General",
    "baseFamily": "Reflect",
    "isFirstVariant": false,
    "variantCount": 2,
    "familyVariants": [
      "Reflect01",
      "Reflect02"
    ],
    "tags": [
      "reflect",
      "reflect02",
      "reflect 02"
    ]
  },
  {
    "name": "RefreshCcw01",
    "label": "Refresh Ccw 01",
    "category": "Arrows",
    "baseFamily": "RefreshCcw",
    "isFirstVariant": true,
    "variantCount": 5,
    "familyVariants": [
      "RefreshCcw01",
      "RefreshCcw02",
      "RefreshCcw03",
      "RefreshCcw04",
      "RefreshCcw05"
    ],
    "tags": [
      "refresh",
      "ccw",
      "refreshccw01",
      "refresh ccw 01",
      "refreshccw"
    ]
  },
  {
    "name": "RefreshCcw02",
    "label": "Refresh Ccw 02",
    "category": "Arrows",
    "baseFamily": "RefreshCcw",
    "isFirstVariant": false,
    "variantCount": 5,
    "familyVariants": [
      "RefreshCcw01",
      "RefreshCcw02",
      "RefreshCcw03",
      "RefreshCcw04",
      "RefreshCcw05"
    ],
    "tags": [
      "refresh",
      "ccw",
      "refreshccw02",
      "refresh ccw 02",
      "refreshccw"
    ]
  },
  {
    "name": "RefreshCcw03",
    "label": "Refresh Ccw 03",
    "category": "Arrows",
    "baseFamily": "RefreshCcw",
    "isFirstVariant": false,
    "variantCount": 5,
    "familyVariants": [
      "RefreshCcw01",
      "RefreshCcw02",
      "RefreshCcw03",
      "RefreshCcw04",
      "RefreshCcw05"
    ],
    "tags": [
      "refresh",
      "ccw",
      "refreshccw03",
      "refresh ccw 03",
      "refreshccw"
    ]
  },
  {
    "name": "RefreshCcw04",
    "label": "Refresh Ccw 04",
    "category": "Arrows",
    "baseFamily": "RefreshCcw",
    "isFirstVariant": false,
    "variantCount": 5,
    "familyVariants": [
      "RefreshCcw01",
      "RefreshCcw02",
      "RefreshCcw03",
      "RefreshCcw04",
      "RefreshCcw05"
    ],
    "tags": [
      "refresh",
      "ccw",
      "refreshccw04",
      "refresh ccw 04",
      "refreshccw"
    ]
  },
  {
    "name": "RefreshCcw05",
    "label": "Refresh Ccw 05",
    "category": "Arrows",
    "baseFamily": "RefreshCcw",
    "isFirstVariant": false,
    "variantCount": 5,
    "familyVariants": [
      "RefreshCcw01",
      "RefreshCcw02",
      "RefreshCcw03",
      "RefreshCcw04",
      "RefreshCcw05"
    ],
    "tags": [
      "refresh",
      "ccw",
      "refreshccw05",
      "refresh ccw 05",
      "refreshccw"
    ]
  },
  {
    "name": "RefreshCw01",
    "label": "Refresh Cw 01",
    "category": "Arrows",
    "baseFamily": "RefreshCw",
    "isFirstVariant": true,
    "variantCount": 5,
    "familyVariants": [
      "RefreshCw01",
      "RefreshCw02",
      "RefreshCw03",
      "RefreshCw04",
      "RefreshCw05"
    ],
    "tags": [
      "refresh",
      "cw",
      "refreshcw01",
      "refresh cw 01",
      "refreshcw"
    ]
  },
  {
    "name": "RefreshCw02",
    "label": "Refresh Cw 02",
    "category": "Arrows",
    "baseFamily": "RefreshCw",
    "isFirstVariant": false,
    "variantCount": 5,
    "familyVariants": [
      "RefreshCw01",
      "RefreshCw02",
      "RefreshCw03",
      "RefreshCw04",
      "RefreshCw05"
    ],
    "tags": [
      "refresh",
      "cw",
      "refreshcw02",
      "refresh cw 02",
      "refreshcw"
    ]
  },
  {
    "name": "RefreshCw03",
    "label": "Refresh Cw 03",
    "category": "Arrows",
    "baseFamily": "RefreshCw",
    "isFirstVariant": false,
    "variantCount": 5,
    "familyVariants": [
      "RefreshCw01",
      "RefreshCw02",
      "RefreshCw03",
      "RefreshCw04",
      "RefreshCw05"
    ],
    "tags": [
      "refresh",
      "cw",
      "refreshcw03",
      "refresh cw 03",
      "refreshcw"
    ]
  },
  {
    "name": "RefreshCw04",
    "label": "Refresh Cw 04",
    "category": "Arrows",
    "baseFamily": "RefreshCw",
    "isFirstVariant": false,
    "variantCount": 5,
    "familyVariants": [
      "RefreshCw01",
      "RefreshCw02",
      "RefreshCw03",
      "RefreshCw04",
      "RefreshCw05"
    ],
    "tags": [
      "refresh",
      "cw",
      "refreshcw04",
      "refresh cw 04",
      "refreshcw"
    ]
  },
  {
    "name": "RefreshCw05",
    "label": "Refresh Cw 05",
    "category": "Arrows",
    "baseFamily": "RefreshCw",
    "isFirstVariant": false,
    "variantCount": 5,
    "familyVariants": [
      "RefreshCw01",
      "RefreshCw02",
      "RefreshCw03",
      "RefreshCw04",
      "RefreshCw05"
    ],
    "tags": [
      "refresh",
      "cw",
      "refreshcw05",
      "refresh cw 05",
      "refreshcw"
    ]
  },
  {
    "name": "Repeat01",
    "label": "Repeat 01",
    "category": "General",
    "baseFamily": "Repeat",
    "isFirstVariant": true,
    "variantCount": 4,
    "familyVariants": [
      "Repeat01",
      "Repeat02",
      "Repeat03",
      "Repeat04"
    ],
    "tags": [
      "repeat",
      "repeat01",
      "repeat 01"
    ]
  },
  {
    "name": "Repeat02",
    "label": "Repeat 02",
    "category": "General",
    "baseFamily": "Repeat",
    "isFirstVariant": false,
    "variantCount": 4,
    "familyVariants": [
      "Repeat01",
      "Repeat02",
      "Repeat03",
      "Repeat04"
    ],
    "tags": [
      "repeat",
      "repeat02",
      "repeat 02"
    ]
  },
  {
    "name": "Repeat03",
    "label": "Repeat 03",
    "category": "General",
    "baseFamily": "Repeat",
    "isFirstVariant": false,
    "variantCount": 4,
    "familyVariants": [
      "Repeat01",
      "Repeat02",
      "Repeat03",
      "Repeat04"
    ],
    "tags": [
      "repeat",
      "repeat03",
      "repeat 03"
    ]
  },
  {
    "name": "Repeat04",
    "label": "Repeat 04",
    "category": "General",
    "baseFamily": "Repeat",
    "isFirstVariant": false,
    "variantCount": 4,
    "familyVariants": [
      "Repeat01",
      "Repeat02",
      "Repeat03",
      "Repeat04"
    ],
    "tags": [
      "repeat",
      "repeat04",
      "repeat 04"
    ]
  },
  {
    "name": "ReverseLeft",
    "label": "Reverse Left",
    "category": "Arrows",
    "baseFamily": "ReverseLeft",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "ReverseLeft"
    ],
    "tags": [
      "reverse",
      "left",
      "reverseleft",
      "reverse left"
    ]
  },
  {
    "name": "ReverseRight",
    "label": "Reverse Right",
    "category": "Arrows",
    "baseFamily": "ReverseRight",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "ReverseRight"
    ],
    "tags": [
      "reverse",
      "right",
      "reverseright",
      "reverse right"
    ]
  },
  {
    "name": "RightIndent01",
    "label": "Right Indent 01",
    "category": "General",
    "baseFamily": "RightIndent",
    "isFirstVariant": true,
    "variantCount": 2,
    "familyVariants": [
      "RightIndent01",
      "RightIndent02"
    ],
    "tags": [
      "right",
      "indent",
      "rightindent01",
      "right indent 01",
      "rightindent"
    ]
  },
  {
    "name": "RightIndent02",
    "label": "Right Indent 02",
    "category": "General",
    "baseFamily": "RightIndent",
    "isFirstVariant": false,
    "variantCount": 2,
    "familyVariants": [
      "RightIndent01",
      "RightIndent02"
    ],
    "tags": [
      "right",
      "indent",
      "rightindent02",
      "right indent 02",
      "rightindent"
    ]
  },
  {
    "name": "Rocket01",
    "label": "Rocket 01",
    "category": "Maps & travel",
    "baseFamily": "Rocket",
    "isFirstVariant": true,
    "variantCount": 2,
    "familyVariants": [
      "Rocket01",
      "Rocket02"
    ],
    "tags": [
      "rocket",
      "rocket01",
      "rocket 01"
    ]
  },
  {
    "name": "Rocket02",
    "label": "Rocket 02",
    "category": "Maps & travel",
    "baseFamily": "Rocket",
    "isFirstVariant": false,
    "variantCount": 2,
    "familyVariants": [
      "Rocket01",
      "Rocket02"
    ],
    "tags": [
      "rocket",
      "rocket02",
      "rocket 02"
    ]
  },
  {
    "name": "RollerBrush",
    "label": "Roller Brush",
    "category": "General",
    "baseFamily": "RollerBrush",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "RollerBrush"
    ],
    "tags": [
      "roller",
      "brush",
      "rollerbrush",
      "roller brush"
    ]
  },
  {
    "name": "Route",
    "label": "Route",
    "category": "Maps & travel",
    "baseFamily": "Route",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "Route"
    ],
    "tags": [
      "route"
    ]
  },
  {
    "name": "Rows01",
    "label": "Rows 01",
    "category": "Layout",
    "baseFamily": "Rows",
    "isFirstVariant": true,
    "variantCount": 3,
    "familyVariants": [
      "Rows01",
      "Rows02",
      "Rows03"
    ],
    "tags": [
      "rows",
      "rows01",
      "rows 01"
    ]
  },
  {
    "name": "Rows02",
    "label": "Rows 02",
    "category": "Layout",
    "baseFamily": "Rows",
    "isFirstVariant": false,
    "variantCount": 3,
    "familyVariants": [
      "Rows01",
      "Rows02",
      "Rows03"
    ],
    "tags": [
      "rows",
      "rows02",
      "rows 02"
    ]
  },
  {
    "name": "Rows03",
    "label": "Rows 03",
    "category": "Layout",
    "baseFamily": "Rows",
    "isFirstVariant": false,
    "variantCount": 3,
    "familyVariants": [
      "Rows01",
      "Rows02",
      "Rows03"
    ],
    "tags": [
      "rows",
      "rows03",
      "rows 03"
    ]
  },
  {
    "name": "Rss01",
    "label": "Rss 01",
    "category": "Communication",
    "baseFamily": "Rss",
    "isFirstVariant": true,
    "variantCount": 2,
    "familyVariants": [
      "Rss01",
      "Rss02"
    ],
    "tags": [
      "rss",
      "rss01",
      "rss 01"
    ]
  },
  {
    "name": "Rss02",
    "label": "Rss 02",
    "category": "Communication",
    "baseFamily": "Rss",
    "isFirstVariant": false,
    "variantCount": 2,
    "familyVariants": [
      "Rss01",
      "Rss02"
    ],
    "tags": [
      "rss",
      "rss02",
      "rss 02"
    ]
  },
  {
    "name": "Ruler",
    "label": "Ruler",
    "category": "General",
    "baseFamily": "Ruler",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "Ruler"
    ],
    "tags": [
      "ruler"
    ]
  },
  {
    "name": "Safe",
    "label": "Safe",
    "category": "Finance & eCommerce",
    "baseFamily": "Safe",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "Safe"
    ],
    "tags": [
      "safe",
      "vault",
      "storage",
      "funds",
      "savings",
      "secure",
      "deposit box"
    ]
  },
  {
    "name": "Sale01",
    "label": "Sale 01",
    "category": "Finance & eCommerce",
    "baseFamily": "Sale",
    "isFirstVariant": true,
    "variantCount": 4,
    "familyVariants": [
      "Sale01",
      "Sale02",
      "Sale03",
      "Sale04"
    ],
    "tags": [
      "sale",
      "sale01",
      "sale 01"
    ]
  },
  {
    "name": "Sale02",
    "label": "Sale 02",
    "category": "Finance & eCommerce",
    "baseFamily": "Sale",
    "isFirstVariant": false,
    "variantCount": 4,
    "familyVariants": [
      "Sale01",
      "Sale02",
      "Sale03",
      "Sale04"
    ],
    "tags": [
      "sale",
      "sale02",
      "sale 02"
    ]
  },
  {
    "name": "Sale03",
    "label": "Sale 03",
    "category": "Finance & eCommerce",
    "baseFamily": "Sale",
    "isFirstVariant": false,
    "variantCount": 4,
    "familyVariants": [
      "Sale01",
      "Sale02",
      "Sale03",
      "Sale04"
    ],
    "tags": [
      "sale",
      "sale03",
      "sale 03"
    ]
  },
  {
    "name": "Sale04",
    "label": "Sale 04",
    "category": "Finance & eCommerce",
    "baseFamily": "Sale",
    "isFirstVariant": false,
    "variantCount": 4,
    "familyVariants": [
      "Sale01",
      "Sale02",
      "Sale03",
      "Sale04"
    ],
    "tags": [
      "sale",
      "sale04",
      "sale 04"
    ]
  },
  {
    "name": "Save01",
    "label": "Save 01",
    "category": "General",
    "baseFamily": "Save",
    "isFirstVariant": true,
    "variantCount": 3,
    "familyVariants": [
      "Save01",
      "Save02",
      "Save03"
    ],
    "tags": [
      "save",
      "save01",
      "save 01"
    ]
  },
  {
    "name": "Save02",
    "label": "Save 02",
    "category": "General",
    "baseFamily": "Save",
    "isFirstVariant": false,
    "variantCount": 3,
    "familyVariants": [
      "Save01",
      "Save02",
      "Save03"
    ],
    "tags": [
      "save",
      "save02",
      "save 02"
    ]
  },
  {
    "name": "Save03",
    "label": "Save 03",
    "category": "General",
    "baseFamily": "Save",
    "isFirstVariant": false,
    "variantCount": 3,
    "familyVariants": [
      "Save01",
      "Save02",
      "Save03"
    ],
    "tags": [
      "save",
      "save03",
      "save 03"
    ]
  },
  {
    "name": "Scale01",
    "label": "Scale 01",
    "category": "Finance & eCommerce",
    "baseFamily": "Scale",
    "isFirstVariant": true,
    "variantCount": 3,
    "familyVariants": [
      "Scale01",
      "Scale02",
      "Scale03"
    ],
    "tags": [
      "scale",
      "balance",
      "legal",
      "law",
      "justice",
      "court",
      "weigh",
      "lawyer",
      "tax",
      "scale01",
      "scale 01"
    ]
  },
  {
    "name": "Scale02",
    "label": "Scale 02",
    "category": "Finance & eCommerce",
    "baseFamily": "Scale",
    "isFirstVariant": false,
    "variantCount": 3,
    "familyVariants": [
      "Scale01",
      "Scale02",
      "Scale03"
    ],
    "tags": [
      "scale",
      "balance",
      "legal",
      "law",
      "justice",
      "court",
      "weigh",
      "lawyer",
      "scale02",
      "scale 02"
    ]
  },
  {
    "name": "Scale03",
    "label": "Scale 03",
    "category": "Finance & eCommerce",
    "baseFamily": "Scale",
    "isFirstVariant": false,
    "variantCount": 3,
    "familyVariants": [
      "Scale01",
      "Scale02",
      "Scale03"
    ],
    "tags": [
      "scale",
      "balance",
      "legal",
      "law",
      "justice",
      "court",
      "weigh",
      "lawyer",
      "scale03",
      "scale 03"
    ]
  },
  {
    "name": "Scales01",
    "label": "Scales 01",
    "category": "Finance & eCommerce",
    "baseFamily": "Scales",
    "isFirstVariant": true,
    "variantCount": 2,
    "familyVariants": [
      "Scales01",
      "Scales02"
    ],
    "tags": [
      "scales",
      "scales01",
      "scales 01"
    ]
  },
  {
    "name": "Scales02",
    "label": "Scales 02",
    "category": "Finance & eCommerce",
    "baseFamily": "Scales",
    "isFirstVariant": false,
    "variantCount": 2,
    "familyVariants": [
      "Scales01",
      "Scales02"
    ],
    "tags": [
      "scales",
      "scales02",
      "scales 02"
    ]
  },
  {
    "name": "Scan",
    "label": "Scan",
    "category": "Security",
    "baseFamily": "Scan",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "Scan"
    ],
    "tags": [
      "scan"
    ]
  },
  {
    "name": "Scissors01",
    "label": "Scissors 01",
    "category": "Editor",
    "baseFamily": "Scissors",
    "isFirstVariant": true,
    "variantCount": 2,
    "familyVariants": [
      "Scissors01",
      "Scissors02"
    ],
    "tags": [
      "scissors",
      "scissors01",
      "scissors 01"
    ]
  },
  {
    "name": "Scissors02",
    "label": "Scissors 02",
    "category": "Editor",
    "baseFamily": "Scissors",
    "isFirstVariant": false,
    "variantCount": 2,
    "familyVariants": [
      "Scissors01",
      "Scissors02"
    ],
    "tags": [
      "scissors",
      "scissors02",
      "scissors 02"
    ]
  },
  {
    "name": "ScissorsCut01",
    "label": "Scissors Cut 01",
    "category": "Editor",
    "baseFamily": "ScissorsCut",
    "isFirstVariant": true,
    "variantCount": 2,
    "familyVariants": [
      "ScissorsCut01",
      "ScissorsCut02"
    ],
    "tags": [
      "scissors",
      "cut",
      "scissorscut01",
      "scissors cut 01",
      "scissorscut"
    ]
  },
  {
    "name": "ScissorsCut02",
    "label": "Scissors Cut 02",
    "category": "Editor",
    "baseFamily": "ScissorsCut",
    "isFirstVariant": false,
    "variantCount": 2,
    "familyVariants": [
      "ScissorsCut01",
      "ScissorsCut02"
    ],
    "tags": [
      "scissors",
      "cut",
      "scissorscut02",
      "scissors cut 02",
      "scissorscut"
    ]
  },
  {
    "name": "SearchLg",
    "label": "Search Lg",
    "category": "General",
    "baseFamily": "SearchLg",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "SearchLg"
    ],
    "tags": [
      "search",
      "lg",
      "searchlg",
      "search lg"
    ]
  },
  {
    "name": "SearchMd",
    "label": "Search Md",
    "category": "General",
    "baseFamily": "SearchMd",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "SearchMd"
    ],
    "tags": [
      "search",
      "md",
      "searchmd",
      "search md"
    ]
  },
  {
    "name": "SearchRefraction",
    "label": "Search Refraction",
    "category": "General",
    "baseFamily": "SearchRefraction",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "SearchRefraction"
    ],
    "tags": [
      "search",
      "refraction",
      "searchrefraction",
      "search refraction"
    ]
  },
  {
    "name": "SearchSm",
    "label": "Search Sm",
    "category": "General",
    "baseFamily": "SearchSm",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "SearchSm"
    ],
    "tags": [
      "search",
      "sm",
      "searchsm",
      "search sm"
    ]
  },
  {
    "name": "Send01",
    "label": "Send 01",
    "category": "Communication",
    "baseFamily": "Send",
    "isFirstVariant": true,
    "variantCount": 3,
    "familyVariants": [
      "Send01",
      "Send02",
      "Send03"
    ],
    "tags": [
      "send",
      "send01",
      "send 01"
    ]
  },
  {
    "name": "Send02",
    "label": "Send 02",
    "category": "Communication",
    "baseFamily": "Send",
    "isFirstVariant": false,
    "variantCount": 3,
    "familyVariants": [
      "Send01",
      "Send02",
      "Send03"
    ],
    "tags": [
      "send",
      "send02",
      "send 02"
    ]
  },
  {
    "name": "Send03",
    "label": "Send 03",
    "category": "Communication",
    "baseFamily": "Send",
    "isFirstVariant": false,
    "variantCount": 3,
    "familyVariants": [
      "Send01",
      "Send02",
      "Send03"
    ],
    "tags": [
      "send",
      "send03",
      "send 03"
    ]
  },
  {
    "name": "Server01",
    "label": "Server 01",
    "category": "Media & devices",
    "baseFamily": "Server",
    "isFirstVariant": true,
    "variantCount": 6,
    "familyVariants": [
      "Server01",
      "Server02",
      "Server03",
      "Server04",
      "Server05",
      "Server06"
    ],
    "tags": [
      "server",
      "server01",
      "server 01"
    ]
  },
  {
    "name": "Server02",
    "label": "Server 02",
    "category": "Media & devices",
    "baseFamily": "Server",
    "isFirstVariant": false,
    "variantCount": 6,
    "familyVariants": [
      "Server01",
      "Server02",
      "Server03",
      "Server04",
      "Server05",
      "Server06"
    ],
    "tags": [
      "server",
      "server02",
      "server 02"
    ]
  },
  {
    "name": "Server03",
    "label": "Server 03",
    "category": "Media & devices",
    "baseFamily": "Server",
    "isFirstVariant": false,
    "variantCount": 6,
    "familyVariants": [
      "Server01",
      "Server02",
      "Server03",
      "Server04",
      "Server05",
      "Server06"
    ],
    "tags": [
      "server",
      "server03",
      "server 03"
    ]
  },
  {
    "name": "Server04",
    "label": "Server 04",
    "category": "Media & devices",
    "baseFamily": "Server",
    "isFirstVariant": false,
    "variantCount": 6,
    "familyVariants": [
      "Server01",
      "Server02",
      "Server03",
      "Server04",
      "Server05",
      "Server06"
    ],
    "tags": [
      "server",
      "server04",
      "server 04"
    ]
  },
  {
    "name": "Server05",
    "label": "Server 05",
    "category": "Media & devices",
    "baseFamily": "Server",
    "isFirstVariant": false,
    "variantCount": 6,
    "familyVariants": [
      "Server01",
      "Server02",
      "Server03",
      "Server04",
      "Server05",
      "Server06"
    ],
    "tags": [
      "server",
      "server05",
      "server 05"
    ]
  },
  {
    "name": "Server06",
    "label": "Server 06",
    "category": "Media & devices",
    "baseFamily": "Server",
    "isFirstVariant": false,
    "variantCount": 6,
    "familyVariants": [
      "Server01",
      "Server02",
      "Server03",
      "Server04",
      "Server05",
      "Server06"
    ],
    "tags": [
      "server",
      "server06",
      "server 06"
    ]
  },
  {
    "name": "Settings01",
    "label": "Settings 01",
    "category": "General",
    "baseFamily": "Settings",
    "isFirstVariant": true,
    "variantCount": 4,
    "familyVariants": [
      "Settings01",
      "Settings02",
      "Settings03",
      "Settings04"
    ],
    "tags": [
      "settings",
      "settings01",
      "settings 01"
    ]
  },
  {
    "name": "Settings02",
    "label": "Settings 02",
    "category": "General",
    "baseFamily": "Settings",
    "isFirstVariant": false,
    "variantCount": 4,
    "familyVariants": [
      "Settings01",
      "Settings02",
      "Settings03",
      "Settings04"
    ],
    "tags": [
      "settings",
      "settings02",
      "settings 02"
    ]
  },
  {
    "name": "Settings03",
    "label": "Settings 03",
    "category": "General",
    "baseFamily": "Settings",
    "isFirstVariant": false,
    "variantCount": 4,
    "familyVariants": [
      "Settings01",
      "Settings02",
      "Settings03",
      "Settings04"
    ],
    "tags": [
      "settings",
      "settings03",
      "settings 03"
    ]
  },
  {
    "name": "Settings04",
    "label": "Settings 04",
    "category": "General",
    "baseFamily": "Settings",
    "isFirstVariant": false,
    "variantCount": 4,
    "familyVariants": [
      "Settings01",
      "Settings02",
      "Settings03",
      "Settings04"
    ],
    "tags": [
      "settings",
      "settings04",
      "settings 04"
    ]
  },
  {
    "name": "Share01",
    "label": "Share 01",
    "category": "Communication",
    "baseFamily": "Share",
    "isFirstVariant": true,
    "variantCount": 7,
    "familyVariants": [
      "Share01",
      "Share02",
      "Share03",
      "Share04",
      "Share05",
      "Share06",
      "Share07"
    ],
    "tags": [
      "share",
      "share01",
      "share 01"
    ]
  },
  {
    "name": "Share02",
    "label": "Share 02",
    "category": "Communication",
    "baseFamily": "Share",
    "isFirstVariant": false,
    "variantCount": 7,
    "familyVariants": [
      "Share01",
      "Share02",
      "Share03",
      "Share04",
      "Share05",
      "Share06",
      "Share07"
    ],
    "tags": [
      "share",
      "share02",
      "share 02"
    ]
  },
  {
    "name": "Share03",
    "label": "Share 03",
    "category": "Communication",
    "baseFamily": "Share",
    "isFirstVariant": false,
    "variantCount": 7,
    "familyVariants": [
      "Share01",
      "Share02",
      "Share03",
      "Share04",
      "Share05",
      "Share06",
      "Share07"
    ],
    "tags": [
      "share",
      "share03",
      "share 03"
    ]
  },
  {
    "name": "Share04",
    "label": "Share 04",
    "category": "Communication",
    "baseFamily": "Share",
    "isFirstVariant": false,
    "variantCount": 7,
    "familyVariants": [
      "Share01",
      "Share02",
      "Share03",
      "Share04",
      "Share05",
      "Share06",
      "Share07"
    ],
    "tags": [
      "share",
      "share04",
      "share 04"
    ]
  },
  {
    "name": "Share05",
    "label": "Share 05",
    "category": "Communication",
    "baseFamily": "Share",
    "isFirstVariant": false,
    "variantCount": 7,
    "familyVariants": [
      "Share01",
      "Share02",
      "Share03",
      "Share04",
      "Share05",
      "Share06",
      "Share07"
    ],
    "tags": [
      "share",
      "share05",
      "share 05"
    ]
  },
  {
    "name": "Share06",
    "label": "Share 06",
    "category": "Communication",
    "baseFamily": "Share",
    "isFirstVariant": false,
    "variantCount": 7,
    "familyVariants": [
      "Share01",
      "Share02",
      "Share03",
      "Share04",
      "Share05",
      "Share06",
      "Share07"
    ],
    "tags": [
      "share",
      "share06",
      "share 06"
    ]
  },
  {
    "name": "Share07",
    "label": "Share 07",
    "category": "Communication",
    "baseFamily": "Share",
    "isFirstVariant": false,
    "variantCount": 7,
    "familyVariants": [
      "Share01",
      "Share02",
      "Share03",
      "Share04",
      "Share05",
      "Share06",
      "Share07"
    ],
    "tags": [
      "share",
      "share07",
      "share 07"
    ]
  },
  {
    "name": "Shield01",
    "label": "Shield 01",
    "category": "Security",
    "baseFamily": "Shield",
    "isFirstVariant": true,
    "variantCount": 3,
    "familyVariants": [
      "Shield01",
      "Shield02",
      "Shield03"
    ],
    "tags": [
      "shield",
      "insurance",
      "protection",
      "security",
      "warranty",
      "guarantee",
      "safe",
      "policy",
      "shield01",
      "shield 01"
    ]
  },
  {
    "name": "Shield02",
    "label": "Shield 02",
    "category": "Security",
    "baseFamily": "Shield",
    "isFirstVariant": false,
    "variantCount": 3,
    "familyVariants": [
      "Shield01",
      "Shield02",
      "Shield03"
    ],
    "tags": [
      "shield",
      "insurance",
      "protection",
      "security",
      "warranty",
      "shield02",
      "shield 02"
    ]
  },
  {
    "name": "Shield03",
    "label": "Shield 03",
    "category": "Security",
    "baseFamily": "Shield",
    "isFirstVariant": false,
    "variantCount": 3,
    "familyVariants": [
      "Shield01",
      "Shield02",
      "Shield03"
    ],
    "tags": [
      "shield",
      "shield03",
      "shield 03"
    ]
  },
  {
    "name": "ShieldDollar",
    "label": "Shield Dollar",
    "category": "Security",
    "baseFamily": "ShieldDollar",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "ShieldDollar"
    ],
    "tags": [
      "shield",
      "dollar",
      "shielddollar",
      "shield dollar"
    ]
  },
  {
    "name": "ShieldOff",
    "label": "Shield Off",
    "category": "Security",
    "baseFamily": "ShieldOff",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "ShieldOff"
    ],
    "tags": [
      "shield",
      "off",
      "shieldoff",
      "shield off"
    ]
  },
  {
    "name": "ShieldPlus",
    "label": "Shield Plus",
    "category": "Security",
    "baseFamily": "ShieldPlus",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "ShieldPlus"
    ],
    "tags": [
      "shield",
      "plus",
      "shieldplus",
      "shield plus"
    ]
  },
  {
    "name": "ShieldTick",
    "label": "Shield Tick",
    "category": "Security",
    "baseFamily": "ShieldTick",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "ShieldTick"
    ],
    "tags": [
      "shield",
      "tick",
      "shieldtick",
      "shield tick"
    ]
  },
  {
    "name": "ShieldZap",
    "label": "Shield Zap",
    "category": "Security",
    "baseFamily": "ShieldZap",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "ShieldZap"
    ],
    "tags": [
      "shield",
      "zap",
      "shieldzap",
      "shield zap"
    ]
  },
  {
    "name": "ShoppingBag01",
    "label": "Shopping Bag 01",
    "category": "Finance & eCommerce",
    "baseFamily": "ShoppingBag",
    "isFirstVariant": true,
    "variantCount": 3,
    "familyVariants": [
      "ShoppingBag01",
      "ShoppingBag02",
      "ShoppingBag03"
    ],
    "tags": [
      "shopping",
      "bag",
      "groceries",
      "store",
      "retail",
      "clothes",
      "supermarket",
      "mall",
      "fashion",
      "buy",
      "shoppingbag01",
      "shopping bag 01",
      "shoppingbag"
    ]
  },
  {
    "name": "ShoppingBag02",
    "label": "Shopping Bag 02",
    "category": "Finance & eCommerce",
    "baseFamily": "ShoppingBag",
    "isFirstVariant": false,
    "variantCount": 3,
    "familyVariants": [
      "ShoppingBag01",
      "ShoppingBag02",
      "ShoppingBag03"
    ],
    "tags": [
      "shopping",
      "bag",
      "groceries",
      "store",
      "retail",
      "clothes",
      "supermarket",
      "mall",
      "shoppingbag02",
      "shopping bag 02",
      "shoppingbag"
    ]
  },
  {
    "name": "ShoppingBag03",
    "label": "Shopping Bag 03",
    "category": "Finance & eCommerce",
    "baseFamily": "ShoppingBag",
    "isFirstVariant": false,
    "variantCount": 3,
    "familyVariants": [
      "ShoppingBag01",
      "ShoppingBag02",
      "ShoppingBag03"
    ],
    "tags": [
      "shopping",
      "bag",
      "groceries",
      "store",
      "retail",
      "clothes",
      "supermarket",
      "mall",
      "shoppingbag03",
      "shopping bag 03",
      "shoppingbag"
    ]
  },
  {
    "name": "ShoppingCart01",
    "label": "Shopping Cart 01",
    "category": "Finance & eCommerce",
    "baseFamily": "ShoppingCart",
    "isFirstVariant": true,
    "variantCount": 3,
    "familyVariants": [
      "ShoppingCart01",
      "ShoppingCart02",
      "ShoppingCart03"
    ],
    "tags": [
      "shopping",
      "cart",
      "checkout",
      "ecommerce",
      "orders",
      "buy",
      "groceries",
      "market",
      "shoppingcart01",
      "shopping cart 01",
      "shoppingcart"
    ]
  },
  {
    "name": "ShoppingCart02",
    "label": "Shopping Cart 02",
    "category": "Finance & eCommerce",
    "baseFamily": "ShoppingCart",
    "isFirstVariant": false,
    "variantCount": 3,
    "familyVariants": [
      "ShoppingCart01",
      "ShoppingCart02",
      "ShoppingCart03"
    ],
    "tags": [
      "shopping",
      "cart",
      "checkout",
      "ecommerce",
      "orders",
      "buy",
      "shoppingcart02",
      "shopping cart 02",
      "shoppingcart"
    ]
  },
  {
    "name": "ShoppingCart03",
    "label": "Shopping Cart 03",
    "category": "Finance & eCommerce",
    "baseFamily": "ShoppingCart",
    "isFirstVariant": false,
    "variantCount": 3,
    "familyVariants": [
      "ShoppingCart01",
      "ShoppingCart02",
      "ShoppingCart03"
    ],
    "tags": [
      "shopping",
      "cart",
      "checkout",
      "ecommerce",
      "orders",
      "buy",
      "shoppingcart03",
      "shopping cart 03",
      "shoppingcart"
    ]
  },
  {
    "name": "Shuffle01",
    "label": "Shuffle 01",
    "category": "Arrows",
    "baseFamily": "Shuffle",
    "isFirstVariant": true,
    "variantCount": 2,
    "familyVariants": [
      "Shuffle01",
      "Shuffle02"
    ],
    "tags": [
      "shuffle",
      "shuffle01",
      "shuffle 01"
    ]
  },
  {
    "name": "Shuffle02",
    "label": "Shuffle 02",
    "category": "Arrows",
    "baseFamily": "Shuffle",
    "isFirstVariant": false,
    "variantCount": 2,
    "familyVariants": [
      "Shuffle01",
      "Shuffle02"
    ],
    "tags": [
      "shuffle",
      "shuffle02",
      "shuffle 02"
    ]
  },
  {
    "name": "Signal01",
    "label": "Signal 01",
    "category": "Communication",
    "baseFamily": "Signal",
    "isFirstVariant": true,
    "variantCount": 3,
    "familyVariants": [
      "Signal01",
      "Signal02",
      "Signal03"
    ],
    "tags": [
      "signal",
      "signal01",
      "signal 01"
    ]
  },
  {
    "name": "Signal02",
    "label": "Signal 02",
    "category": "Communication",
    "baseFamily": "Signal",
    "isFirstVariant": false,
    "variantCount": 3,
    "familyVariants": [
      "Signal01",
      "Signal02",
      "Signal03"
    ],
    "tags": [
      "signal",
      "signal02",
      "signal 02"
    ]
  },
  {
    "name": "Signal03",
    "label": "Signal 03",
    "category": "Communication",
    "baseFamily": "Signal",
    "isFirstVariant": false,
    "variantCount": 3,
    "familyVariants": [
      "Signal01",
      "Signal02",
      "Signal03"
    ],
    "tags": [
      "signal",
      "signal03",
      "signal 03"
    ]
  },
  {
    "name": "Simcard",
    "label": "Simcard",
    "category": "Media & devices",
    "baseFamily": "Simcard",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "Simcard"
    ],
    "tags": [
      "simcard"
    ]
  },
  {
    "name": "Skew",
    "label": "Skew",
    "category": "General",
    "baseFamily": "Skew",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "Skew"
    ],
    "tags": [
      "skew"
    ]
  },
  {
    "name": "SkipBack",
    "label": "Skip Back",
    "category": "General",
    "baseFamily": "SkipBack",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "SkipBack"
    ],
    "tags": [
      "skip",
      "back",
      "skipback",
      "skip back"
    ]
  },
  {
    "name": "SkipForward",
    "label": "Skip Forward",
    "category": "General",
    "baseFamily": "SkipForward",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "SkipForward"
    ],
    "tags": [
      "skip",
      "forward",
      "skipforward",
      "skip forward"
    ]
  },
  {
    "name": "SlashCircle01",
    "label": "Slash Circle 01",
    "category": "General",
    "baseFamily": "SlashCircle",
    "isFirstVariant": true,
    "variantCount": 2,
    "familyVariants": [
      "SlashCircle01",
      "SlashCircle02"
    ],
    "tags": [
      "slash",
      "circle",
      "slashcircle01",
      "slash circle 01",
      "slashcircle"
    ]
  },
  {
    "name": "SlashCircle02",
    "label": "Slash Circle 02",
    "category": "General",
    "baseFamily": "SlashCircle",
    "isFirstVariant": false,
    "variantCount": 2,
    "familyVariants": [
      "SlashCircle01",
      "SlashCircle02"
    ],
    "tags": [
      "slash",
      "circle",
      "slashcircle02",
      "slash circle 02",
      "slashcircle"
    ]
  },
  {
    "name": "SlashDivider",
    "label": "Slash Divider",
    "category": "General",
    "baseFamily": "SlashDivider",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "SlashDivider"
    ],
    "tags": [
      "slash",
      "divider",
      "slashdivider",
      "slash divider"
    ]
  },
  {
    "name": "SlashOctagon",
    "label": "Slash Octagon",
    "category": "General",
    "baseFamily": "SlashOctagon",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "SlashOctagon"
    ],
    "tags": [
      "slash",
      "octagon",
      "slashoctagon",
      "slash octagon"
    ]
  },
  {
    "name": "Sliders01",
    "label": "Sliders 01",
    "category": "Charts",
    "baseFamily": "Sliders",
    "isFirstVariant": true,
    "variantCount": 4,
    "familyVariants": [
      "Sliders01",
      "Sliders02",
      "Sliders03",
      "Sliders04"
    ],
    "tags": [
      "sliders",
      "sliders01",
      "sliders 01"
    ]
  },
  {
    "name": "Sliders02",
    "label": "Sliders 02",
    "category": "Charts",
    "baseFamily": "Sliders",
    "isFirstVariant": false,
    "variantCount": 4,
    "familyVariants": [
      "Sliders01",
      "Sliders02",
      "Sliders03",
      "Sliders04"
    ],
    "tags": [
      "sliders",
      "sliders02",
      "sliders 02"
    ]
  },
  {
    "name": "Sliders03",
    "label": "Sliders 03",
    "category": "Charts",
    "baseFamily": "Sliders",
    "isFirstVariant": false,
    "variantCount": 4,
    "familyVariants": [
      "Sliders01",
      "Sliders02",
      "Sliders03",
      "Sliders04"
    ],
    "tags": [
      "sliders",
      "sliders03",
      "sliders 03"
    ]
  },
  {
    "name": "Sliders04",
    "label": "Sliders 04",
    "category": "Charts",
    "baseFamily": "Sliders",
    "isFirstVariant": false,
    "variantCount": 4,
    "familyVariants": [
      "Sliders01",
      "Sliders02",
      "Sliders03",
      "Sliders04"
    ],
    "tags": [
      "sliders",
      "sliders04",
      "sliders 04"
    ]
  },
  {
    "name": "Snowflake01",
    "label": "Snowflake 01",
    "category": "Weather",
    "baseFamily": "Snowflake",
    "isFirstVariant": true,
    "variantCount": 2,
    "familyVariants": [
      "Snowflake01",
      "Snowflake02"
    ],
    "tags": [
      "snowflake",
      "snowflake01",
      "snowflake 01"
    ]
  },
  {
    "name": "Snowflake02",
    "label": "Snowflake 02",
    "category": "Weather",
    "baseFamily": "Snowflake",
    "isFirstVariant": false,
    "variantCount": 2,
    "familyVariants": [
      "Snowflake01",
      "Snowflake02"
    ],
    "tags": [
      "snowflake",
      "snowflake02",
      "snowflake 02"
    ]
  },
  {
    "name": "SpacingHeight01",
    "label": "Spacing Height 01",
    "category": "Layout",
    "baseFamily": "SpacingHeight",
    "isFirstVariant": true,
    "variantCount": 2,
    "familyVariants": [
      "SpacingHeight01",
      "SpacingHeight02"
    ],
    "tags": [
      "spacing",
      "height",
      "spacingheight01",
      "spacing height 01",
      "spacingheight"
    ]
  },
  {
    "name": "SpacingHeight02",
    "label": "Spacing Height 02",
    "category": "Layout",
    "baseFamily": "SpacingHeight",
    "isFirstVariant": false,
    "variantCount": 2,
    "familyVariants": [
      "SpacingHeight01",
      "SpacingHeight02"
    ],
    "tags": [
      "spacing",
      "height",
      "spacingheight02",
      "spacing height 02",
      "spacingheight"
    ]
  },
  {
    "name": "SpacingWidth01",
    "label": "Spacing Width 01",
    "category": "Layout",
    "baseFamily": "SpacingWidth",
    "isFirstVariant": true,
    "variantCount": 2,
    "familyVariants": [
      "SpacingWidth01",
      "SpacingWidth02"
    ],
    "tags": [
      "spacing",
      "width",
      "spacingwidth01",
      "spacing width 01",
      "spacingwidth"
    ]
  },
  {
    "name": "SpacingWidth02",
    "label": "Spacing Width 02",
    "category": "Layout",
    "baseFamily": "SpacingWidth",
    "isFirstVariant": false,
    "variantCount": 2,
    "familyVariants": [
      "SpacingWidth01",
      "SpacingWidth02"
    ],
    "tags": [
      "spacing",
      "width",
      "spacingwidth02",
      "spacing width 02",
      "spacingwidth"
    ]
  },
  {
    "name": "Speaker01",
    "label": "Speaker 01",
    "category": "Media & devices",
    "baseFamily": "Speaker",
    "isFirstVariant": true,
    "variantCount": 3,
    "familyVariants": [
      "Speaker01",
      "Speaker02",
      "Speaker03"
    ],
    "tags": [
      "speaker",
      "speaker01",
      "speaker 01"
    ]
  },
  {
    "name": "Speaker02",
    "label": "Speaker 02",
    "category": "Media & devices",
    "baseFamily": "Speaker",
    "isFirstVariant": false,
    "variantCount": 3,
    "familyVariants": [
      "Speaker01",
      "Speaker02",
      "Speaker03"
    ],
    "tags": [
      "speaker",
      "speaker02",
      "speaker 02"
    ]
  },
  {
    "name": "Speaker03",
    "label": "Speaker 03",
    "category": "Media & devices",
    "baseFamily": "Speaker",
    "isFirstVariant": false,
    "variantCount": 3,
    "familyVariants": [
      "Speaker01",
      "Speaker02",
      "Speaker03"
    ],
    "tags": [
      "speaker",
      "speaker03",
      "speaker 03"
    ]
  },
  {
    "name": "Speedometer01",
    "label": "Speedometer 01",
    "category": "General",
    "baseFamily": "Speedometer",
    "isFirstVariant": true,
    "variantCount": 4,
    "familyVariants": [
      "Speedometer01",
      "Speedometer02",
      "Speedometer03",
      "Speedometer04"
    ],
    "tags": [
      "speedometer",
      "speedometer01",
      "speedometer 01"
    ]
  },
  {
    "name": "Speedometer02",
    "label": "Speedometer 02",
    "category": "General",
    "baseFamily": "Speedometer",
    "isFirstVariant": false,
    "variantCount": 4,
    "familyVariants": [
      "Speedometer01",
      "Speedometer02",
      "Speedometer03",
      "Speedometer04"
    ],
    "tags": [
      "speedometer",
      "speedometer02",
      "speedometer 02"
    ]
  },
  {
    "name": "Speedometer03",
    "label": "Speedometer 03",
    "category": "General",
    "baseFamily": "Speedometer",
    "isFirstVariant": false,
    "variantCount": 4,
    "familyVariants": [
      "Speedometer01",
      "Speedometer02",
      "Speedometer03",
      "Speedometer04"
    ],
    "tags": [
      "speedometer",
      "speedometer03",
      "speedometer 03"
    ]
  },
  {
    "name": "Speedometer04",
    "label": "Speedometer 04",
    "category": "General",
    "baseFamily": "Speedometer",
    "isFirstVariant": false,
    "variantCount": 4,
    "familyVariants": [
      "Speedometer01",
      "Speedometer02",
      "Speedometer03",
      "Speedometer04"
    ],
    "tags": [
      "speedometer",
      "speedometer04",
      "speedometer 04"
    ]
  },
  {
    "name": "Square",
    "label": "Square",
    "category": "Shapes",
    "baseFamily": "Square",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "Square"
    ],
    "tags": [
      "square"
    ]
  },
  {
    "name": "Stand",
    "label": "Stand",
    "category": "General",
    "baseFamily": "Stand",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "Stand"
    ],
    "tags": [
      "stand"
    ]
  },
  {
    "name": "Star01",
    "label": "Star 01",
    "category": "Alerts & feedback",
    "baseFamily": "Star",
    "isFirstVariant": true,
    "variantCount": 7,
    "familyVariants": [
      "Star01",
      "Star02",
      "Star03",
      "Star04",
      "Star05",
      "Star06",
      "Star07"
    ],
    "tags": [
      "star",
      "star01",
      "star 01"
    ]
  },
  {
    "name": "Star02",
    "label": "Star 02",
    "category": "Alerts & feedback",
    "baseFamily": "Star",
    "isFirstVariant": false,
    "variantCount": 7,
    "familyVariants": [
      "Star01",
      "Star02",
      "Star03",
      "Star04",
      "Star05",
      "Star06",
      "Star07"
    ],
    "tags": [
      "star",
      "star02",
      "star 02"
    ]
  },
  {
    "name": "Star03",
    "label": "Star 03",
    "category": "Alerts & feedback",
    "baseFamily": "Star",
    "isFirstVariant": false,
    "variantCount": 7,
    "familyVariants": [
      "Star01",
      "Star02",
      "Star03",
      "Star04",
      "Star05",
      "Star06",
      "Star07"
    ],
    "tags": [
      "star",
      "star03",
      "star 03"
    ]
  },
  {
    "name": "Star04",
    "label": "Star 04",
    "category": "Alerts & feedback",
    "baseFamily": "Star",
    "isFirstVariant": false,
    "variantCount": 7,
    "familyVariants": [
      "Star01",
      "Star02",
      "Star03",
      "Star04",
      "Star05",
      "Star06",
      "Star07"
    ],
    "tags": [
      "star",
      "star04",
      "star 04"
    ]
  },
  {
    "name": "Star05",
    "label": "Star 05",
    "category": "Alerts & feedback",
    "baseFamily": "Star",
    "isFirstVariant": false,
    "variantCount": 7,
    "familyVariants": [
      "Star01",
      "Star02",
      "Star03",
      "Star04",
      "Star05",
      "Star06",
      "Star07"
    ],
    "tags": [
      "star",
      "star05",
      "star 05"
    ]
  },
  {
    "name": "Star06",
    "label": "Star 06",
    "category": "Alerts & feedback",
    "baseFamily": "Star",
    "isFirstVariant": false,
    "variantCount": 7,
    "familyVariants": [
      "Star01",
      "Star02",
      "Star03",
      "Star04",
      "Star05",
      "Star06",
      "Star07"
    ],
    "tags": [
      "star",
      "star06",
      "star 06"
    ]
  },
  {
    "name": "Star07",
    "label": "Star 07",
    "category": "Alerts & feedback",
    "baseFamily": "Star",
    "isFirstVariant": false,
    "variantCount": 7,
    "familyVariants": [
      "Star01",
      "Star02",
      "Star03",
      "Star04",
      "Star05",
      "Star06",
      "Star07"
    ],
    "tags": [
      "star",
      "star07",
      "star 07"
    ]
  },
  {
    "name": "Stars01",
    "label": "Stars 01",
    "category": "Weather",
    "baseFamily": "Stars",
    "isFirstVariant": true,
    "variantCount": 3,
    "familyVariants": [
      "Stars01",
      "Stars02",
      "Stars03"
    ],
    "tags": [
      "stars",
      "stars01",
      "stars 01"
    ]
  },
  {
    "name": "Stars02",
    "label": "Stars 02",
    "category": "Weather",
    "baseFamily": "Stars",
    "isFirstVariant": false,
    "variantCount": 3,
    "familyVariants": [
      "Stars01",
      "Stars02",
      "Stars03"
    ],
    "tags": [
      "stars",
      "stars02",
      "stars 02"
    ]
  },
  {
    "name": "Stars03",
    "label": "Stars 03",
    "category": "Weather",
    "baseFamily": "Stars",
    "isFirstVariant": false,
    "variantCount": 3,
    "familyVariants": [
      "Stars01",
      "Stars02",
      "Stars03"
    ],
    "tags": [
      "stars",
      "stars03",
      "stars 03"
    ]
  },
  {
    "name": "StickerCircle",
    "label": "Sticker Circle",
    "category": "General",
    "baseFamily": "StickerCircle",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "StickerCircle"
    ],
    "tags": [
      "sticker",
      "circle",
      "stickercircle",
      "sticker circle"
    ]
  },
  {
    "name": "StickerSquare",
    "label": "Sticker Square",
    "category": "General",
    "baseFamily": "StickerSquare",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "StickerSquare"
    ],
    "tags": [
      "sticker",
      "square",
      "stickersquare",
      "sticker square"
    ]
  },
  {
    "name": "Stop",
    "label": "Stop",
    "category": "General",
    "baseFamily": "Stop",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "Stop"
    ],
    "tags": [
      "stop"
    ]
  },
  {
    "name": "StopCircle",
    "label": "Stop Circle",
    "category": "General",
    "baseFamily": "StopCircle",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "StopCircle"
    ],
    "tags": [
      "stop",
      "circle",
      "stopcircle",
      "stop circle"
    ]
  },
  {
    "name": "StopSquare",
    "label": "Stop Square",
    "category": "General",
    "baseFamily": "StopSquare",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "StopSquare"
    ],
    "tags": [
      "stop",
      "square",
      "stopsquare",
      "stop square"
    ]
  },
  {
    "name": "Strikethrough01",
    "label": "Strikethrough 01",
    "category": "Editor",
    "baseFamily": "Strikethrough",
    "isFirstVariant": true,
    "variantCount": 2,
    "familyVariants": [
      "Strikethrough01",
      "Strikethrough02"
    ],
    "tags": [
      "strikethrough",
      "strikethrough01",
      "strikethrough 01"
    ]
  },
  {
    "name": "Strikethrough02",
    "label": "Strikethrough 02",
    "category": "Editor",
    "baseFamily": "Strikethrough",
    "isFirstVariant": false,
    "variantCount": 2,
    "familyVariants": [
      "Strikethrough01",
      "Strikethrough02"
    ],
    "tags": [
      "strikethrough",
      "strikethrough02",
      "strikethrough 02"
    ]
  },
  {
    "name": "StrikethroughSquare",
    "label": "Strikethrough Square",
    "category": "Editor",
    "baseFamily": "StrikethroughSquare",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "StrikethroughSquare"
    ],
    "tags": [
      "strikethrough",
      "square",
      "strikethroughsquare",
      "strikethrough square"
    ]
  },
  {
    "name": "Subscript",
    "label": "Subscript",
    "category": "Editor",
    "baseFamily": "Subscript",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "Subscript"
    ],
    "tags": [
      "subscript"
    ]
  },
  {
    "name": "Sun",
    "label": "Sun",
    "category": "Weather",
    "baseFamily": "Sun",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "Sun"
    ],
    "tags": [
      "sun",
      "solar",
      "nature",
      "weather",
      "garden",
      "pool",
      "energy",
      "park",
      "outdoor",
      "summer"
    ]
  },
  {
    "name": "SunSetting01",
    "label": "Sun Setting 01",
    "category": "Weather",
    "baseFamily": "SunSetting",
    "isFirstVariant": true,
    "variantCount": 3,
    "familyVariants": [
      "SunSetting01",
      "SunSetting02",
      "SunSetting03"
    ],
    "tags": [
      "sun",
      "setting",
      "sunsetting01",
      "sun setting 01",
      "sunsetting"
    ]
  },
  {
    "name": "SunSetting02",
    "label": "Sun Setting 02",
    "category": "Weather",
    "baseFamily": "SunSetting",
    "isFirstVariant": false,
    "variantCount": 3,
    "familyVariants": [
      "SunSetting01",
      "SunSetting02",
      "SunSetting03"
    ],
    "tags": [
      "sun",
      "setting",
      "sunsetting02",
      "sun setting 02",
      "sunsetting"
    ]
  },
  {
    "name": "SunSetting03",
    "label": "Sun Setting 03",
    "category": "Weather",
    "baseFamily": "SunSetting",
    "isFirstVariant": false,
    "variantCount": 3,
    "familyVariants": [
      "SunSetting01",
      "SunSetting02",
      "SunSetting03"
    ],
    "tags": [
      "sun",
      "setting",
      "sunsetting03",
      "sun setting 03",
      "sunsetting"
    ]
  },
  {
    "name": "Sunrise",
    "label": "Sunrise",
    "category": "Weather",
    "baseFamily": "Sunrise",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "Sunrise"
    ],
    "tags": [
      "sunrise"
    ]
  },
  {
    "name": "Sunset",
    "label": "Sunset",
    "category": "Weather",
    "baseFamily": "Sunset",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "Sunset"
    ],
    "tags": [
      "sunset"
    ]
  },
  {
    "name": "SwitchHorizontal01",
    "label": "Switch Horizontal 01",
    "category": "Arrows",
    "baseFamily": "SwitchHorizontal",
    "isFirstVariant": true,
    "variantCount": 2,
    "familyVariants": [
      "SwitchHorizontal01",
      "SwitchHorizontal02"
    ],
    "tags": [
      "switch",
      "horizontal",
      "switchhorizontal01",
      "switch horizontal 01",
      "switchhorizontal"
    ]
  },
  {
    "name": "SwitchHorizontal02",
    "label": "Switch Horizontal 02",
    "category": "Arrows",
    "baseFamily": "SwitchHorizontal",
    "isFirstVariant": false,
    "variantCount": 2,
    "familyVariants": [
      "SwitchHorizontal01",
      "SwitchHorizontal02"
    ],
    "tags": [
      "switch",
      "horizontal",
      "switchhorizontal02",
      "switch horizontal 02",
      "switchhorizontal"
    ]
  },
  {
    "name": "SwitchVertical01",
    "label": "Switch Vertical 01",
    "category": "Arrows",
    "baseFamily": "SwitchVertical",
    "isFirstVariant": true,
    "variantCount": 2,
    "familyVariants": [
      "SwitchVertical01",
      "SwitchVertical02"
    ],
    "tags": [
      "switch",
      "vertical",
      "switchvertical01",
      "switch vertical 01",
      "switchvertical"
    ]
  },
  {
    "name": "SwitchVertical02",
    "label": "Switch Vertical 02",
    "category": "Arrows",
    "baseFamily": "SwitchVertical",
    "isFirstVariant": false,
    "variantCount": 2,
    "familyVariants": [
      "SwitchVertical01",
      "SwitchVertical02"
    ],
    "tags": [
      "switch",
      "vertical",
      "switchvertical02",
      "switch vertical 02",
      "switchvertical"
    ]
  },
  {
    "name": "Table",
    "label": "Table",
    "category": "Layout",
    "baseFamily": "Table",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "Table"
    ],
    "tags": [
      "table"
    ]
  },
  {
    "name": "Tablet01",
    "label": "Tablet 01",
    "category": "Media & devices",
    "baseFamily": "Tablet",
    "isFirstVariant": true,
    "variantCount": 2,
    "familyVariants": [
      "Tablet01",
      "Tablet02"
    ],
    "tags": [
      "tablet",
      "tablet01",
      "tablet 01"
    ]
  },
  {
    "name": "Tablet02",
    "label": "Tablet 02",
    "category": "Media & devices",
    "baseFamily": "Tablet",
    "isFirstVariant": false,
    "variantCount": 2,
    "familyVariants": [
      "Tablet01",
      "Tablet02"
    ],
    "tags": [
      "tablet",
      "tablet02",
      "tablet 02"
    ]
  },
  {
    "name": "Tag01",
    "label": "Tag 01",
    "category": "Finance & eCommerce",
    "baseFamily": "Tag",
    "isFirstVariant": true,
    "variantCount": 3,
    "familyVariants": [
      "Tag01",
      "Tag02",
      "Tag03"
    ],
    "tags": [
      "tag",
      "label",
      "category",
      "offer",
      "coupon",
      "discount",
      "badge",
      "tags",
      "loyalty",
      "tag01",
      "tag 01"
    ]
  },
  {
    "name": "Tag02",
    "label": "Tag 02",
    "category": "Finance & eCommerce",
    "baseFamily": "Tag",
    "isFirstVariant": false,
    "variantCount": 3,
    "familyVariants": [
      "Tag01",
      "Tag02",
      "Tag03"
    ],
    "tags": [
      "tag",
      "label",
      "category",
      "offer",
      "coupon",
      "discount",
      "badge",
      "tag02",
      "tag 02"
    ]
  },
  {
    "name": "Tag03",
    "label": "Tag 03",
    "category": "Finance & eCommerce",
    "baseFamily": "Tag",
    "isFirstVariant": false,
    "variantCount": 3,
    "familyVariants": [
      "Tag01",
      "Tag02",
      "Tag03"
    ],
    "tags": [
      "tag",
      "label",
      "category",
      "offer",
      "coupon",
      "discount",
      "badge",
      "tag03",
      "tag 03"
    ]
  },
  {
    "name": "Target01",
    "label": "Target 01",
    "category": "General",
    "baseFamily": "Target",
    "isFirstVariant": true,
    "variantCount": 5,
    "familyVariants": [
      "Target01",
      "Target02",
      "Target03",
      "Target04",
      "Target05"
    ],
    "tags": [
      "target",
      "target01",
      "target 01"
    ]
  },
  {
    "name": "Target02",
    "label": "Target 02",
    "category": "General",
    "baseFamily": "Target",
    "isFirstVariant": false,
    "variantCount": 5,
    "familyVariants": [
      "Target01",
      "Target02",
      "Target03",
      "Target04",
      "Target05"
    ],
    "tags": [
      "target",
      "target02",
      "target 02"
    ]
  },
  {
    "name": "Target03",
    "label": "Target 03",
    "category": "General",
    "baseFamily": "Target",
    "isFirstVariant": false,
    "variantCount": 5,
    "familyVariants": [
      "Target01",
      "Target02",
      "Target03",
      "Target04",
      "Target05"
    ],
    "tags": [
      "target",
      "target03",
      "target 03"
    ]
  },
  {
    "name": "Target04",
    "label": "Target 04",
    "category": "General",
    "baseFamily": "Target",
    "isFirstVariant": false,
    "variantCount": 5,
    "familyVariants": [
      "Target01",
      "Target02",
      "Target03",
      "Target04",
      "Target05"
    ],
    "tags": [
      "target",
      "target04",
      "target 04"
    ]
  },
  {
    "name": "Target05",
    "label": "Target 05",
    "category": "General",
    "baseFamily": "Target",
    "isFirstVariant": false,
    "variantCount": 5,
    "familyVariants": [
      "Target01",
      "Target02",
      "Target03",
      "Target04",
      "Target05"
    ],
    "tags": [
      "target",
      "target05",
      "target 05"
    ]
  },
  {
    "name": "Telescope",
    "label": "Telescope",
    "category": "Education",
    "baseFamily": "Telescope",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "Telescope"
    ],
    "tags": [
      "telescope"
    ]
  },
  {
    "name": "Terminal",
    "label": "Terminal",
    "category": "Development",
    "baseFamily": "Terminal",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "Terminal"
    ],
    "tags": [
      "terminal"
    ]
  },
  {
    "name": "TerminalBrowser",
    "label": "Terminal Browser",
    "category": "Development",
    "baseFamily": "TerminalBrowser",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "TerminalBrowser"
    ],
    "tags": [
      "terminal",
      "browser",
      "terminalbrowser",
      "terminal browser"
    ]
  },
  {
    "name": "TerminalCircle",
    "label": "Terminal Circle",
    "category": "Development",
    "baseFamily": "TerminalCircle",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "TerminalCircle"
    ],
    "tags": [
      "terminal",
      "circle",
      "terminalcircle",
      "terminal circle"
    ]
  },
  {
    "name": "TerminalSquare",
    "label": "Terminal Square",
    "category": "Development",
    "baseFamily": "TerminalSquare",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "TerminalSquare"
    ],
    "tags": [
      "terminal",
      "square",
      "terminalsquare",
      "terminal square"
    ]
  },
  {
    "name": "TextInput",
    "label": "Text Input",
    "category": "Editor",
    "baseFamily": "TextInput",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "TextInput"
    ],
    "tags": [
      "text",
      "input",
      "textinput",
      "text input"
    ]
  },
  {
    "name": "Thermometer01",
    "label": "Thermometer 01",
    "category": "Weather",
    "baseFamily": "Thermometer",
    "isFirstVariant": true,
    "variantCount": 3,
    "familyVariants": [
      "Thermometer01",
      "Thermometer02",
      "Thermometer03"
    ],
    "tags": [
      "thermometer",
      "thermometer01",
      "thermometer 01"
    ]
  },
  {
    "name": "Thermometer02",
    "label": "Thermometer 02",
    "category": "Weather",
    "baseFamily": "Thermometer",
    "isFirstVariant": false,
    "variantCount": 3,
    "familyVariants": [
      "Thermometer01",
      "Thermometer02",
      "Thermometer03"
    ],
    "tags": [
      "thermometer",
      "thermometer02",
      "thermometer 02"
    ]
  },
  {
    "name": "Thermometer03",
    "label": "Thermometer 03",
    "category": "Weather",
    "baseFamily": "Thermometer",
    "isFirstVariant": false,
    "variantCount": 3,
    "familyVariants": [
      "Thermometer01",
      "Thermometer02",
      "Thermometer03"
    ],
    "tags": [
      "thermometer",
      "thermometer03",
      "thermometer 03"
    ]
  },
  {
    "name": "ThermometerCold",
    "label": "Thermometer Cold",
    "category": "Weather",
    "baseFamily": "ThermometerCold",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "ThermometerCold"
    ],
    "tags": [
      "thermometer",
      "cold",
      "thermometercold",
      "thermometer cold"
    ]
  },
  {
    "name": "ThermometerWarm",
    "label": "Thermometer Warm",
    "category": "Weather",
    "baseFamily": "ThermometerWarm",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "ThermometerWarm"
    ],
    "tags": [
      "thermometer",
      "warm",
      "thermometerwarm",
      "thermometer warm"
    ]
  },
  {
    "name": "ThumbsDown",
    "label": "Thumbs Down",
    "category": "Alerts & feedback",
    "baseFamily": "ThumbsDown",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "ThumbsDown"
    ],
    "tags": [
      "thumbs",
      "down",
      "thumbsdown",
      "thumbs down"
    ]
  },
  {
    "name": "ThumbsUp",
    "label": "Thumbs Up",
    "category": "Alerts & feedback",
    "baseFamily": "ThumbsUp",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "ThumbsUp"
    ],
    "tags": [
      "thumbs",
      "up",
      "thumbsup",
      "thumbs up"
    ]
  },
  {
    "name": "Ticket01",
    "label": "Ticket 01",
    "category": "Finance & eCommerce",
    "baseFamily": "Ticket",
    "isFirstVariant": true,
    "variantCount": 2,
    "familyVariants": [
      "Ticket01",
      "Ticket02"
    ],
    "tags": [
      "ticket",
      "admission",
      "concert",
      "cinema",
      "event",
      "transit",
      "pass",
      "ticket01",
      "ticket 01"
    ]
  },
  {
    "name": "Ticket02",
    "label": "Ticket 02",
    "category": "Finance & eCommerce",
    "baseFamily": "Ticket",
    "isFirstVariant": false,
    "variantCount": 2,
    "familyVariants": [
      "Ticket01",
      "Ticket02"
    ],
    "tags": [
      "ticket",
      "admission",
      "concert",
      "cinema",
      "event",
      "transit",
      "pass",
      "ticket02",
      "ticket 02"
    ]
  },
  {
    "name": "Toggle01Left",
    "label": "Toggle 01 Left",
    "category": "General",
    "baseFamily": "Toggle01Left",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "Toggle01Left"
    ],
    "tags": [
      "toggle",
      "left",
      "toggle01left",
      "toggle 01 left"
    ]
  },
  {
    "name": "Toggle01Right",
    "label": "Toggle 01 Right",
    "category": "General",
    "baseFamily": "Toggle01Right",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "Toggle01Right"
    ],
    "tags": [
      "toggle",
      "right",
      "toggle01right",
      "toggle 01 right"
    ]
  },
  {
    "name": "Toggle02Left",
    "label": "Toggle 02 Left",
    "category": "General",
    "baseFamily": "Toggle02Left",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "Toggle02Left"
    ],
    "tags": [
      "toggle",
      "left",
      "toggle02left",
      "toggle 02 left"
    ]
  },
  {
    "name": "Toggle02Right",
    "label": "Toggle 02 Right",
    "category": "General",
    "baseFamily": "Toggle02Right",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "Toggle02Right"
    ],
    "tags": [
      "toggle",
      "right",
      "toggle02right",
      "toggle 02 right"
    ]
  },
  {
    "name": "Toggle03Left",
    "label": "Toggle 03 Left",
    "category": "General",
    "baseFamily": "Toggle03Left",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "Toggle03Left"
    ],
    "tags": [
      "toggle",
      "left",
      "toggle03left",
      "toggle 03 left"
    ]
  },
  {
    "name": "Toggle03Right",
    "label": "Toggle 03 Right",
    "category": "General",
    "baseFamily": "Toggle03Right",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "Toggle03Right"
    ],
    "tags": [
      "toggle",
      "right",
      "toggle03right",
      "toggle 03 right"
    ]
  },
  {
    "name": "Tool01",
    "label": "Tool 01",
    "category": "General",
    "baseFamily": "Tool",
    "isFirstVariant": true,
    "variantCount": 2,
    "familyVariants": [
      "Tool01",
      "Tool02"
    ],
    "tags": [
      "tool",
      "maintenance",
      "repair",
      "mechanic",
      "hardware",
      "renovation",
      "construction",
      "tools",
      "tool01",
      "tool 01"
    ]
  },
  {
    "name": "Tool02",
    "label": "Tool 02",
    "category": "General",
    "baseFamily": "Tool",
    "isFirstVariant": false,
    "variantCount": 2,
    "familyVariants": [
      "Tool01",
      "Tool02"
    ],
    "tags": [
      "tool",
      "maintenance",
      "repair",
      "mechanic",
      "hardware",
      "renovation",
      "construction",
      "tool02",
      "tool 02"
    ]
  },
  {
    "name": "Train",
    "label": "Train",
    "category": "Maps & travel",
    "baseFamily": "Train",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "Train"
    ],
    "tags": [
      "train",
      "commute",
      "metro",
      "subway",
      "railway",
      "transit",
      "ticket",
      "transport"
    ]
  },
  {
    "name": "Tram",
    "label": "Tram",
    "category": "General",
    "baseFamily": "Tram",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "Tram"
    ],
    "tags": [
      "tram"
    ]
  },
  {
    "name": "Transform",
    "label": "Transform",
    "category": "Images",
    "baseFamily": "Transform",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "Transform"
    ],
    "tags": [
      "transform"
    ]
  },
  {
    "name": "Translate01",
    "label": "Translate 01",
    "category": "General",
    "baseFamily": "Translate",
    "isFirstVariant": true,
    "variantCount": 2,
    "familyVariants": [
      "Translate01",
      "Translate02"
    ],
    "tags": [
      "translate",
      "translate01",
      "translate 01"
    ]
  },
  {
    "name": "Translate02",
    "label": "Translate 02",
    "category": "General",
    "baseFamily": "Translate",
    "isFirstVariant": false,
    "variantCount": 2,
    "familyVariants": [
      "Translate01",
      "Translate02"
    ],
    "tags": [
      "translate",
      "translate02",
      "translate 02"
    ]
  },
  {
    "name": "Trash01",
    "label": "Trash 01",
    "category": "Alerts & feedback",
    "baseFamily": "Trash",
    "isFirstVariant": true,
    "variantCount": 4,
    "familyVariants": [
      "Trash01",
      "Trash02",
      "Trash03",
      "Trash04"
    ],
    "tags": [
      "trash",
      "trash01",
      "trash 01"
    ]
  },
  {
    "name": "Trash02",
    "label": "Trash 02",
    "category": "Alerts & feedback",
    "baseFamily": "Trash",
    "isFirstVariant": false,
    "variantCount": 4,
    "familyVariants": [
      "Trash01",
      "Trash02",
      "Trash03",
      "Trash04"
    ],
    "tags": [
      "trash",
      "trash02",
      "trash 02"
    ]
  },
  {
    "name": "Trash03",
    "label": "Trash 03",
    "category": "Alerts & feedback",
    "baseFamily": "Trash",
    "isFirstVariant": false,
    "variantCount": 4,
    "familyVariants": [
      "Trash01",
      "Trash02",
      "Trash03",
      "Trash04"
    ],
    "tags": [
      "trash",
      "trash03",
      "trash 03"
    ]
  },
  {
    "name": "Trash04",
    "label": "Trash 04",
    "category": "Alerts & feedback",
    "baseFamily": "Trash",
    "isFirstVariant": false,
    "variantCount": 4,
    "familyVariants": [
      "Trash01",
      "Trash02",
      "Trash03",
      "Trash04"
    ],
    "tags": [
      "trash",
      "trash04",
      "trash 04"
    ]
  },
  {
    "name": "TrendDown01",
    "label": "Trend Down 01",
    "category": "Charts",
    "baseFamily": "TrendDown",
    "isFirstVariant": true,
    "variantCount": 2,
    "familyVariants": [
      "TrendDown01",
      "TrendDown02"
    ],
    "tags": [
      "trend",
      "down",
      "loss",
      "bear",
      "decrease",
      "drop",
      "expense",
      "decline",
      "negative",
      "trenddown01",
      "trend down 01",
      "trenddown"
    ]
  },
  {
    "name": "TrendDown02",
    "label": "Trend Down 02",
    "category": "Charts",
    "baseFamily": "TrendDown",
    "isFirstVariant": false,
    "variantCount": 2,
    "familyVariants": [
      "TrendDown01",
      "TrendDown02"
    ],
    "tags": [
      "trend",
      "down",
      "loss",
      "bear",
      "decrease",
      "drop",
      "expense",
      "decline",
      "negative",
      "trenddown02",
      "trend down 02",
      "trenddown"
    ]
  },
  {
    "name": "TrendUp01",
    "label": "Trend Up 01",
    "category": "Charts",
    "baseFamily": "TrendUp",
    "isFirstVariant": true,
    "variantCount": 2,
    "familyVariants": [
      "TrendUp01",
      "TrendUp02"
    ],
    "tags": [
      "trend",
      "up",
      "growth",
      "profit",
      "stock",
      "increase",
      "bull",
      "gain",
      "analytics",
      "investments",
      "performance",
      "shares",
      "trendup01",
      "trend up 01",
      "trendup"
    ]
  },
  {
    "name": "TrendUp02",
    "label": "Trend Up 02",
    "category": "Charts",
    "baseFamily": "TrendUp",
    "isFirstVariant": false,
    "variantCount": 2,
    "familyVariants": [
      "TrendUp01",
      "TrendUp02"
    ],
    "tags": [
      "trend",
      "up",
      "growth",
      "profit",
      "stock",
      "increase",
      "bull",
      "gain",
      "analytics",
      "investments",
      "trendup02",
      "trend up 02",
      "trendup"
    ]
  },
  {
    "name": "Triangle",
    "label": "Triangle",
    "category": "Shapes",
    "baseFamily": "Triangle",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "Triangle"
    ],
    "tags": [
      "triangle"
    ]
  },
  {
    "name": "Trophy01",
    "label": "Trophy 01",
    "category": "Finance & eCommerce",
    "baseFamily": "Trophy",
    "isFirstVariant": true,
    "variantCount": 2,
    "familyVariants": [
      "Trophy01",
      "Trophy02"
    ],
    "tags": [
      "trophy",
      "achievement",
      "reward",
      "winner",
      "milestone",
      "goal",
      "prize",
      "award",
      "trophy01",
      "trophy 01"
    ]
  },
  {
    "name": "Trophy02",
    "label": "Trophy 02",
    "category": "Finance & eCommerce",
    "baseFamily": "Trophy",
    "isFirstVariant": false,
    "variantCount": 2,
    "familyVariants": [
      "Trophy01",
      "Trophy02"
    ],
    "tags": [
      "trophy",
      "achievement",
      "reward",
      "winner",
      "milestone",
      "goal",
      "prize",
      "trophy02",
      "trophy 02"
    ]
  },
  {
    "name": "Truck01",
    "label": "Truck 01",
    "category": "Maps & travel",
    "baseFamily": "Truck",
    "isFirstVariant": true,
    "variantCount": 2,
    "familyVariants": [
      "Truck01",
      "Truck02"
    ],
    "tags": [
      "truck",
      "car",
      "vehicle",
      "auto",
      "transport",
      "shipping",
      "delivery",
      "fleet",
      "automobile",
      "truck01",
      "truck 01"
    ]
  },
  {
    "name": "Truck02",
    "label": "Truck 02",
    "category": "Maps & travel",
    "baseFamily": "Truck",
    "isFirstVariant": false,
    "variantCount": 2,
    "familyVariants": [
      "Truck01",
      "Truck02"
    ],
    "tags": [
      "truck",
      "car",
      "vehicle",
      "auto",
      "transport",
      "shipping",
      "delivery",
      "truck02",
      "truck 02"
    ]
  },
  {
    "name": "Tv01",
    "label": "Tv 01",
    "category": "Media & devices",
    "baseFamily": "Tv",
    "isFirstVariant": true,
    "variantCount": 3,
    "familyVariants": [
      "Tv01",
      "Tv02",
      "Tv03"
    ],
    "tags": [
      "tv",
      "tv01",
      "tv 01"
    ]
  },
  {
    "name": "Tv02",
    "label": "Tv 02",
    "category": "Media & devices",
    "baseFamily": "Tv",
    "isFirstVariant": false,
    "variantCount": 3,
    "familyVariants": [
      "Tv01",
      "Tv02",
      "Tv03"
    ],
    "tags": [
      "tv",
      "tv02",
      "tv 02"
    ]
  },
  {
    "name": "Tv03",
    "label": "Tv 03",
    "category": "Media & devices",
    "baseFamily": "Tv",
    "isFirstVariant": false,
    "variantCount": 3,
    "familyVariants": [
      "Tv01",
      "Tv02",
      "Tv03"
    ],
    "tags": [
      "tv",
      "tv03",
      "tv 03"
    ]
  },
  {
    "name": "Type01",
    "label": "Type 01",
    "category": "Editor",
    "baseFamily": "Type",
    "isFirstVariant": true,
    "variantCount": 2,
    "familyVariants": [
      "Type01",
      "Type02"
    ],
    "tags": [
      "type",
      "type01",
      "type 01"
    ]
  },
  {
    "name": "Type02",
    "label": "Type 02",
    "category": "Editor",
    "baseFamily": "Type",
    "isFirstVariant": false,
    "variantCount": 2,
    "familyVariants": [
      "Type01",
      "Type02"
    ],
    "tags": [
      "type",
      "type02",
      "type 02"
    ]
  },
  {
    "name": "TypeSquare",
    "label": "Type Square",
    "category": "Editor",
    "baseFamily": "TypeSquare",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "TypeSquare"
    ],
    "tags": [
      "type",
      "square",
      "typesquare",
      "type square"
    ]
  },
  {
    "name": "TypeStrikethrough01",
    "label": "Type Strikethrough 01",
    "category": "Editor",
    "baseFamily": "TypeStrikethrough",
    "isFirstVariant": true,
    "variantCount": 2,
    "familyVariants": [
      "TypeStrikethrough01",
      "TypeStrikethrough02"
    ],
    "tags": [
      "type",
      "strikethrough",
      "typestrikethrough01",
      "type strikethrough 01",
      "typestrikethrough"
    ]
  },
  {
    "name": "TypeStrikethrough02",
    "label": "Type Strikethrough 02",
    "category": "Editor",
    "baseFamily": "TypeStrikethrough",
    "isFirstVariant": false,
    "variantCount": 2,
    "familyVariants": [
      "TypeStrikethrough01",
      "TypeStrikethrough02"
    ],
    "tags": [
      "type",
      "strikethrough",
      "typestrikethrough02",
      "type strikethrough 02",
      "typestrikethrough"
    ]
  },
  {
    "name": "Umbrella01",
    "label": "Umbrella 01",
    "category": "Weather",
    "baseFamily": "Umbrella",
    "isFirstVariant": true,
    "variantCount": 3,
    "familyVariants": [
      "Umbrella01",
      "Umbrella02",
      "Umbrella03"
    ],
    "tags": [
      "umbrella",
      "umbrella01",
      "umbrella 01"
    ]
  },
  {
    "name": "Umbrella02",
    "label": "Umbrella 02",
    "category": "Weather",
    "baseFamily": "Umbrella",
    "isFirstVariant": false,
    "variantCount": 3,
    "familyVariants": [
      "Umbrella01",
      "Umbrella02",
      "Umbrella03"
    ],
    "tags": [
      "umbrella",
      "umbrella02",
      "umbrella 02"
    ]
  },
  {
    "name": "Umbrella03",
    "label": "Umbrella 03",
    "category": "Weather",
    "baseFamily": "Umbrella",
    "isFirstVariant": false,
    "variantCount": 3,
    "familyVariants": [
      "Umbrella01",
      "Umbrella02",
      "Umbrella03"
    ],
    "tags": [
      "umbrella",
      "umbrella03",
      "umbrella 03"
    ]
  },
  {
    "name": "Underline01",
    "label": "Underline 01",
    "category": "Editor",
    "baseFamily": "Underline",
    "isFirstVariant": true,
    "variantCount": 2,
    "familyVariants": [
      "Underline01",
      "Underline02"
    ],
    "tags": [
      "underline",
      "underline01",
      "underline 01"
    ]
  },
  {
    "name": "Underline02",
    "label": "Underline 02",
    "category": "Editor",
    "baseFamily": "Underline",
    "isFirstVariant": false,
    "variantCount": 2,
    "familyVariants": [
      "Underline01",
      "Underline02"
    ],
    "tags": [
      "underline",
      "underline02",
      "underline 02"
    ]
  },
  {
    "name": "UnderlineSquare",
    "label": "Underline Square",
    "category": "Editor",
    "baseFamily": "UnderlineSquare",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "UnderlineSquare"
    ],
    "tags": [
      "underline",
      "square",
      "underlinesquare",
      "underline square"
    ]
  },
  {
    "name": "Upload01",
    "label": "Upload 01",
    "category": "General",
    "baseFamily": "Upload",
    "isFirstVariant": true,
    "variantCount": 4,
    "familyVariants": [
      "Upload01",
      "Upload02",
      "Upload03",
      "Upload04"
    ],
    "tags": [
      "upload",
      "upload01",
      "upload 01"
    ]
  },
  {
    "name": "Upload02",
    "label": "Upload 02",
    "category": "General",
    "baseFamily": "Upload",
    "isFirstVariant": false,
    "variantCount": 4,
    "familyVariants": [
      "Upload01",
      "Upload02",
      "Upload03",
      "Upload04"
    ],
    "tags": [
      "upload",
      "upload02",
      "upload 02"
    ]
  },
  {
    "name": "Upload03",
    "label": "Upload 03",
    "category": "General",
    "baseFamily": "Upload",
    "isFirstVariant": false,
    "variantCount": 4,
    "familyVariants": [
      "Upload01",
      "Upload02",
      "Upload03",
      "Upload04"
    ],
    "tags": [
      "upload",
      "upload03",
      "upload 03"
    ]
  },
  {
    "name": "Upload04",
    "label": "Upload 04",
    "category": "General",
    "baseFamily": "Upload",
    "isFirstVariant": false,
    "variantCount": 4,
    "familyVariants": [
      "Upload01",
      "Upload02",
      "Upload03",
      "Upload04"
    ],
    "tags": [
      "upload",
      "upload04",
      "upload 04"
    ]
  },
  {
    "name": "UploadCloud01",
    "label": "Upload Cloud 01",
    "category": "General",
    "baseFamily": "UploadCloud",
    "isFirstVariant": true,
    "variantCount": 2,
    "familyVariants": [
      "UploadCloud01",
      "UploadCloud02"
    ],
    "tags": [
      "upload",
      "cloud",
      "uploadcloud01",
      "upload cloud 01",
      "uploadcloud"
    ]
  },
  {
    "name": "UploadCloud02",
    "label": "Upload Cloud 02",
    "category": "General",
    "baseFamily": "UploadCloud",
    "isFirstVariant": false,
    "variantCount": 2,
    "familyVariants": [
      "UploadCloud01",
      "UploadCloud02"
    ],
    "tags": [
      "upload",
      "cloud",
      "uploadcloud02",
      "upload cloud 02",
      "uploadcloud"
    ]
  },
  {
    "name": "UsbFlashDrive",
    "label": "Usb Flash Drive",
    "category": "General",
    "baseFamily": "UsbFlashDrive",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "UsbFlashDrive"
    ],
    "tags": [
      "usb",
      "flash",
      "drive",
      "usbflashdrive",
      "usb flash drive"
    ]
  },
  {
    "name": "User01",
    "label": "User 01",
    "category": "Users",
    "baseFamily": "User",
    "isFirstVariant": true,
    "variantCount": 3,
    "familyVariants": [
      "User01",
      "User02",
      "User03"
    ],
    "tags": [
      "user",
      "account",
      "profile",
      "personal",
      "individual",
      "member",
      "me",
      "user01",
      "user 01"
    ]
  },
  {
    "name": "User02",
    "label": "User 02",
    "category": "Users",
    "baseFamily": "User",
    "isFirstVariant": false,
    "variantCount": 3,
    "familyVariants": [
      "User01",
      "User02",
      "User03"
    ],
    "tags": [
      "user",
      "account",
      "profile",
      "personal",
      "individual",
      "member",
      "user02",
      "user 02"
    ]
  },
  {
    "name": "User03",
    "label": "User 03",
    "category": "Users",
    "baseFamily": "User",
    "isFirstVariant": false,
    "variantCount": 3,
    "familyVariants": [
      "User01",
      "User02",
      "User03"
    ],
    "tags": [
      "user",
      "account",
      "profile",
      "personal",
      "individual",
      "member",
      "user03",
      "user 03"
    ]
  },
  {
    "name": "UserCheck01",
    "label": "User Check 01",
    "category": "Users",
    "baseFamily": "UserCheck",
    "isFirstVariant": true,
    "variantCount": 2,
    "familyVariants": [
      "UserCheck01",
      "UserCheck02"
    ],
    "tags": [
      "user",
      "check",
      "verified",
      "authorized",
      "approved user",
      "active",
      "usercheck01",
      "user check 01",
      "usercheck"
    ]
  },
  {
    "name": "UserCheck02",
    "label": "User Check 02",
    "category": "Users",
    "baseFamily": "UserCheck",
    "isFirstVariant": false,
    "variantCount": 2,
    "familyVariants": [
      "UserCheck01",
      "UserCheck02"
    ],
    "tags": [
      "user",
      "check",
      "usercheck02",
      "user check 02",
      "usercheck"
    ]
  },
  {
    "name": "UserCircle",
    "label": "User Circle",
    "category": "Users",
    "baseFamily": "UserCircle",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "UserCircle"
    ],
    "tags": [
      "user",
      "circle",
      "usercircle",
      "user circle"
    ]
  },
  {
    "name": "UserDown01",
    "label": "User Down 01",
    "category": "Users",
    "baseFamily": "UserDown",
    "isFirstVariant": true,
    "variantCount": 2,
    "familyVariants": [
      "UserDown01",
      "UserDown02"
    ],
    "tags": [
      "user",
      "down",
      "userdown01",
      "user down 01",
      "userdown"
    ]
  },
  {
    "name": "UserDown02",
    "label": "User Down 02",
    "category": "Users",
    "baseFamily": "UserDown",
    "isFirstVariant": false,
    "variantCount": 2,
    "familyVariants": [
      "UserDown01",
      "UserDown02"
    ],
    "tags": [
      "user",
      "down",
      "userdown02",
      "user down 02",
      "userdown"
    ]
  },
  {
    "name": "UserEdit",
    "label": "User Edit",
    "category": "Users",
    "baseFamily": "UserEdit",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "UserEdit"
    ],
    "tags": [
      "user",
      "edit",
      "useredit",
      "user edit"
    ]
  },
  {
    "name": "UserLeft01",
    "label": "User Left 01",
    "category": "Users",
    "baseFamily": "UserLeft",
    "isFirstVariant": true,
    "variantCount": 2,
    "familyVariants": [
      "UserLeft01",
      "UserLeft02"
    ],
    "tags": [
      "user",
      "left",
      "userleft01",
      "user left 01",
      "userleft"
    ]
  },
  {
    "name": "UserLeft02",
    "label": "User Left 02",
    "category": "Users",
    "baseFamily": "UserLeft",
    "isFirstVariant": false,
    "variantCount": 2,
    "familyVariants": [
      "UserLeft01",
      "UserLeft02"
    ],
    "tags": [
      "user",
      "left",
      "userleft02",
      "user left 02",
      "userleft"
    ]
  },
  {
    "name": "UserMinus01",
    "label": "User Minus 01",
    "category": "Users",
    "baseFamily": "UserMinus",
    "isFirstVariant": true,
    "variantCount": 2,
    "familyVariants": [
      "UserMinus01",
      "UserMinus02"
    ],
    "tags": [
      "user",
      "minus",
      "userminus01",
      "user minus 01",
      "userminus"
    ]
  },
  {
    "name": "UserMinus02",
    "label": "User Minus 02",
    "category": "Users",
    "baseFamily": "UserMinus",
    "isFirstVariant": false,
    "variantCount": 2,
    "familyVariants": [
      "UserMinus01",
      "UserMinus02"
    ],
    "tags": [
      "user",
      "minus",
      "userminus02",
      "user minus 02",
      "userminus"
    ]
  },
  {
    "name": "UserPlus01",
    "label": "User Plus 01",
    "category": "Users",
    "baseFamily": "UserPlus",
    "isFirstVariant": true,
    "variantCount": 2,
    "familyVariants": [
      "UserPlus01",
      "UserPlus02"
    ],
    "tags": [
      "user",
      "plus",
      "invite",
      "add member",
      "new user",
      "register",
      "userplus01",
      "user plus 01",
      "userplus"
    ]
  },
  {
    "name": "UserPlus02",
    "label": "User Plus 02",
    "category": "Users",
    "baseFamily": "UserPlus",
    "isFirstVariant": false,
    "variantCount": 2,
    "familyVariants": [
      "UserPlus01",
      "UserPlus02"
    ],
    "tags": [
      "user",
      "plus",
      "userplus02",
      "user plus 02",
      "userplus"
    ]
  },
  {
    "name": "UserRight01",
    "label": "User Right 01",
    "category": "Users",
    "baseFamily": "UserRight",
    "isFirstVariant": true,
    "variantCount": 2,
    "familyVariants": [
      "UserRight01",
      "UserRight02"
    ],
    "tags": [
      "user",
      "right",
      "userright01",
      "user right 01",
      "userright"
    ]
  },
  {
    "name": "UserRight02",
    "label": "User Right 02",
    "category": "Users",
    "baseFamily": "UserRight",
    "isFirstVariant": false,
    "variantCount": 2,
    "familyVariants": [
      "UserRight01",
      "UserRight02"
    ],
    "tags": [
      "user",
      "right",
      "userright02",
      "user right 02",
      "userright"
    ]
  },
  {
    "name": "UserSquare",
    "label": "User Square",
    "category": "Users",
    "baseFamily": "UserSquare",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "UserSquare"
    ],
    "tags": [
      "user",
      "square",
      "usersquare",
      "user square"
    ]
  },
  {
    "name": "UserUp01",
    "label": "User Up 01",
    "category": "Users",
    "baseFamily": "UserUp",
    "isFirstVariant": true,
    "variantCount": 2,
    "familyVariants": [
      "UserUp01",
      "UserUp02"
    ],
    "tags": [
      "user",
      "up",
      "userup01",
      "user up 01",
      "userup"
    ]
  },
  {
    "name": "UserUp02",
    "label": "User Up 02",
    "category": "Users",
    "baseFamily": "UserUp",
    "isFirstVariant": false,
    "variantCount": 2,
    "familyVariants": [
      "UserUp01",
      "UserUp02"
    ],
    "tags": [
      "user",
      "up",
      "userup02",
      "user up 02",
      "userup"
    ]
  },
  {
    "name": "UserX01",
    "label": "User X 01",
    "category": "Users",
    "baseFamily": "UserX",
    "isFirstVariant": true,
    "variantCount": 2,
    "familyVariants": [
      "UserX01",
      "UserX02"
    ],
    "tags": [
      "user",
      "x",
      "userx01",
      "user x 01",
      "userx"
    ]
  },
  {
    "name": "UserX02",
    "label": "User X 02",
    "category": "Users",
    "baseFamily": "UserX",
    "isFirstVariant": false,
    "variantCount": 2,
    "familyVariants": [
      "UserX01",
      "UserX02"
    ],
    "tags": [
      "user",
      "x",
      "userx02",
      "user x 02",
      "userx"
    ]
  },
  {
    "name": "Users01",
    "label": "Users 01",
    "category": "Users",
    "baseFamily": "Users",
    "isFirstVariant": true,
    "variantCount": 3,
    "familyVariants": [
      "Users01",
      "Users02",
      "Users03"
    ],
    "tags": [
      "users",
      "team",
      "family",
      "group",
      "community",
      "organization",
      "people",
      "members",
      "users01",
      "users 01"
    ]
  },
  {
    "name": "Users02",
    "label": "Users 02",
    "category": "Users",
    "baseFamily": "Users",
    "isFirstVariant": false,
    "variantCount": 3,
    "familyVariants": [
      "Users01",
      "Users02",
      "Users03"
    ],
    "tags": [
      "users",
      "team",
      "family",
      "group",
      "community",
      "organization",
      "people",
      "users02",
      "users 02"
    ]
  },
  {
    "name": "Users03",
    "label": "Users 03",
    "category": "Users",
    "baseFamily": "Users",
    "isFirstVariant": false,
    "variantCount": 3,
    "familyVariants": [
      "Users01",
      "Users02",
      "Users03"
    ],
    "tags": [
      "users",
      "team",
      "family",
      "group",
      "community",
      "organization",
      "people",
      "users03",
      "users 03"
    ]
  },
  {
    "name": "UsersCheck",
    "label": "Users Check",
    "category": "Users",
    "baseFamily": "UsersCheck",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "UsersCheck"
    ],
    "tags": [
      "users",
      "check",
      "userscheck",
      "users check"
    ]
  },
  {
    "name": "UsersDown",
    "label": "Users Down",
    "category": "Users",
    "baseFamily": "UsersDown",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "UsersDown"
    ],
    "tags": [
      "users",
      "down",
      "usersdown",
      "users down"
    ]
  },
  {
    "name": "UsersEdit",
    "label": "Users Edit",
    "category": "Users",
    "baseFamily": "UsersEdit",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "UsersEdit"
    ],
    "tags": [
      "users",
      "edit",
      "usersedit",
      "users edit"
    ]
  },
  {
    "name": "UsersLeft",
    "label": "Users Left",
    "category": "Users",
    "baseFamily": "UsersLeft",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "UsersLeft"
    ],
    "tags": [
      "users",
      "left",
      "usersleft",
      "users left"
    ]
  },
  {
    "name": "UsersMinus",
    "label": "Users Minus",
    "category": "Users",
    "baseFamily": "UsersMinus",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "UsersMinus"
    ],
    "tags": [
      "users",
      "minus",
      "usersminus",
      "users minus"
    ]
  },
  {
    "name": "UsersPlus",
    "label": "Users Plus",
    "category": "Users",
    "baseFamily": "UsersPlus",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "UsersPlus"
    ],
    "tags": [
      "users",
      "plus",
      "usersplus",
      "users plus"
    ]
  },
  {
    "name": "UsersRight",
    "label": "Users Right",
    "category": "Users",
    "baseFamily": "UsersRight",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "UsersRight"
    ],
    "tags": [
      "users",
      "right",
      "usersright",
      "users right"
    ]
  },
  {
    "name": "UsersUp",
    "label": "Users Up",
    "category": "Users",
    "baseFamily": "UsersUp",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "UsersUp"
    ],
    "tags": [
      "users",
      "up",
      "usersup",
      "users up"
    ]
  },
  {
    "name": "UsersX",
    "label": "Users X",
    "category": "Users",
    "baseFamily": "UsersX",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "UsersX"
    ],
    "tags": [
      "users",
      "x",
      "usersx",
      "users x"
    ]
  },
  {
    "name": "Variable",
    "label": "Variable",
    "category": "Development",
    "baseFamily": "Variable",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "Variable"
    ],
    "tags": [
      "variable"
    ]
  },
  {
    "name": "VideoRecorder",
    "label": "Video Recorder",
    "category": "Media & devices",
    "baseFamily": "VideoRecorder",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "VideoRecorder"
    ],
    "tags": [
      "video",
      "recorder",
      "videorecorder",
      "video recorder"
    ]
  },
  {
    "name": "VideoRecorderOff",
    "label": "Video Recorder Off",
    "category": "Media & devices",
    "baseFamily": "VideoRecorderOff",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "VideoRecorderOff"
    ],
    "tags": [
      "video",
      "recorder",
      "off",
      "videorecorderoff",
      "video recorder off"
    ]
  },
  {
    "name": "Virus",
    "label": "Virus",
    "category": "General",
    "baseFamily": "Virus",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "Virus"
    ],
    "tags": [
      "virus"
    ]
  },
  {
    "name": "Voicemail",
    "label": "Voicemail",
    "category": "Communication",
    "baseFamily": "Voicemail",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "Voicemail"
    ],
    "tags": [
      "voicemail"
    ]
  },
  {
    "name": "VolumeMax",
    "label": "Volume Max",
    "category": "Media & devices",
    "baseFamily": "VolumeMax",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "VolumeMax"
    ],
    "tags": [
      "volume",
      "max",
      "volumemax",
      "volume max"
    ]
  },
  {
    "name": "VolumeMin",
    "label": "Volume Min",
    "category": "Media & devices",
    "baseFamily": "VolumeMin",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "VolumeMin"
    ],
    "tags": [
      "volume",
      "min",
      "volumemin",
      "volume min"
    ]
  },
  {
    "name": "VolumeMinus",
    "label": "Volume Minus",
    "category": "Media & devices",
    "baseFamily": "VolumeMinus",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "VolumeMinus"
    ],
    "tags": [
      "volume",
      "minus",
      "volumeminus",
      "volume minus"
    ]
  },
  {
    "name": "VolumePlus",
    "label": "Volume Plus",
    "category": "Media & devices",
    "baseFamily": "VolumePlus",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "VolumePlus"
    ],
    "tags": [
      "volume",
      "plus",
      "volumeplus",
      "volume plus"
    ]
  },
  {
    "name": "VolumeX",
    "label": "Volume X",
    "category": "Media & devices",
    "baseFamily": "VolumeX",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "VolumeX"
    ],
    "tags": [
      "volume",
      "x",
      "volumex",
      "volume x"
    ]
  },
  {
    "name": "Wallet01",
    "label": "Wallet 01",
    "category": "Finance & eCommerce",
    "baseFamily": "Wallet",
    "isFirstVariant": true,
    "variantCount": 5,
    "familyVariants": [
      "Wallet01",
      "Wallet02",
      "Wallet03",
      "Wallet04",
      "Wallet05"
    ],
    "tags": [
      "wallet",
      "purse",
      "funds",
      "pocket",
      "cash",
      "accounts",
      "holdings",
      "wallet01",
      "wallet 01"
    ]
  },
  {
    "name": "Wallet02",
    "label": "Wallet 02",
    "category": "Finance & eCommerce",
    "baseFamily": "Wallet",
    "isFirstVariant": false,
    "variantCount": 5,
    "familyVariants": [
      "Wallet01",
      "Wallet02",
      "Wallet03",
      "Wallet04",
      "Wallet05"
    ],
    "tags": [
      "wallet",
      "purse",
      "funds",
      "pocket",
      "cash",
      "accounts",
      "holdings",
      "wallet02",
      "wallet 02"
    ]
  },
  {
    "name": "Wallet03",
    "label": "Wallet 03",
    "category": "Finance & eCommerce",
    "baseFamily": "Wallet",
    "isFirstVariant": false,
    "variantCount": 5,
    "familyVariants": [
      "Wallet01",
      "Wallet02",
      "Wallet03",
      "Wallet04",
      "Wallet05"
    ],
    "tags": [
      "wallet",
      "purse",
      "funds",
      "pocket",
      "cash",
      "accounts",
      "holdings",
      "wallet03",
      "wallet 03"
    ]
  },
  {
    "name": "Wallet04",
    "label": "Wallet 04",
    "category": "Finance & eCommerce",
    "baseFamily": "Wallet",
    "isFirstVariant": false,
    "variantCount": 5,
    "familyVariants": [
      "Wallet01",
      "Wallet02",
      "Wallet03",
      "Wallet04",
      "Wallet05"
    ],
    "tags": [
      "wallet",
      "purse",
      "funds",
      "pocket",
      "cash",
      "accounts",
      "holdings",
      "wallet04",
      "wallet 04"
    ]
  },
  {
    "name": "Wallet05",
    "label": "Wallet 05",
    "category": "Finance & eCommerce",
    "baseFamily": "Wallet",
    "isFirstVariant": false,
    "variantCount": 5,
    "familyVariants": [
      "Wallet01",
      "Wallet02",
      "Wallet03",
      "Wallet04",
      "Wallet05"
    ],
    "tags": [
      "wallet",
      "purse",
      "funds",
      "pocket",
      "cash",
      "accounts",
      "holdings",
      "wallet05",
      "wallet 05"
    ]
  },
  {
    "name": "WatchCircle",
    "label": "Watch Circle",
    "category": "Media & devices",
    "baseFamily": "WatchCircle",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "WatchCircle"
    ],
    "tags": [
      "watch",
      "circle",
      "watchcircle",
      "watch circle"
    ]
  },
  {
    "name": "WatchSquare",
    "label": "Watch Square",
    "category": "Media & devices",
    "baseFamily": "WatchSquare",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "WatchSquare"
    ],
    "tags": [
      "watch",
      "square",
      "watchsquare",
      "watch square"
    ]
  },
  {
    "name": "Waves",
    "label": "Waves",
    "category": "General",
    "baseFamily": "Waves",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "Waves"
    ],
    "tags": [
      "waves"
    ]
  },
  {
    "name": "Webcam01",
    "label": "Webcam 01",
    "category": "Media & devices",
    "baseFamily": "Webcam",
    "isFirstVariant": true,
    "variantCount": 2,
    "familyVariants": [
      "Webcam01",
      "Webcam02"
    ],
    "tags": [
      "webcam",
      "webcam01",
      "webcam 01"
    ]
  },
  {
    "name": "Webcam02",
    "label": "Webcam 02",
    "category": "Media & devices",
    "baseFamily": "Webcam",
    "isFirstVariant": false,
    "variantCount": 2,
    "familyVariants": [
      "Webcam01",
      "Webcam02"
    ],
    "tags": [
      "webcam",
      "webcam02",
      "webcam 02"
    ]
  },
  {
    "name": "Wifi",
    "label": "Wifi",
    "category": "Media & devices",
    "baseFamily": "Wifi",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "Wifi"
    ],
    "tags": [
      "wifi"
    ]
  },
  {
    "name": "WifiOff",
    "label": "Wifi Off",
    "category": "Media & devices",
    "baseFamily": "WifiOff",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "WifiOff"
    ],
    "tags": [
      "wifi",
      "off",
      "wifioff",
      "wifi off"
    ]
  },
  {
    "name": "Wind01",
    "label": "Wind 01",
    "category": "Weather",
    "baseFamily": "Wind",
    "isFirstVariant": true,
    "variantCount": 3,
    "familyVariants": [
      "Wind01",
      "Wind02",
      "Wind03"
    ],
    "tags": [
      "wind",
      "wind01",
      "wind 01"
    ]
  },
  {
    "name": "Wind02",
    "label": "Wind 02",
    "category": "Weather",
    "baseFamily": "Wind",
    "isFirstVariant": false,
    "variantCount": 3,
    "familyVariants": [
      "Wind01",
      "Wind02",
      "Wind03"
    ],
    "tags": [
      "wind",
      "wind02",
      "wind 02"
    ]
  },
  {
    "name": "Wind03",
    "label": "Wind 03",
    "category": "Weather",
    "baseFamily": "Wind",
    "isFirstVariant": false,
    "variantCount": 3,
    "familyVariants": [
      "Wind01",
      "Wind02",
      "Wind03"
    ],
    "tags": [
      "wind",
      "wind03",
      "wind 03"
    ]
  },
  {
    "name": "X",
    "label": "X",
    "category": "Alerts & feedback",
    "baseFamily": "X",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "X"
    ],
    "tags": [
      "x"
    ]
  },
  {
    "name": "XCircle",
    "label": "XCircle",
    "category": "Alerts & feedback",
    "baseFamily": "XCircle",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "XCircle"
    ],
    "tags": [
      "xcircle"
    ]
  },
  {
    "name": "XClose",
    "label": "XClose",
    "category": "Alerts & feedback",
    "baseFamily": "XClose",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "XClose"
    ],
    "tags": [
      "xclose"
    ]
  },
  {
    "name": "XSquare",
    "label": "XSquare",
    "category": "Alerts & feedback",
    "baseFamily": "XSquare",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "XSquare"
    ],
    "tags": [
      "xsquare"
    ]
  },
  {
    "name": "Youtube",
    "label": "Youtube",
    "category": "General",
    "baseFamily": "Youtube",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "Youtube"
    ],
    "tags": [
      "youtube"
    ]
  },
  {
    "name": "Zap",
    "label": "Zap",
    "category": "Weather",
    "baseFamily": "Zap",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "Zap"
    ],
    "tags": [
      "zap",
      "electricity",
      "utilities",
      "energy",
      "power",
      "fast",
      "lightning",
      "gas",
      "electric"
    ]
  },
  {
    "name": "ZapCircle",
    "label": "Zap Circle",
    "category": "Weather",
    "baseFamily": "ZapCircle",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "ZapCircle"
    ],
    "tags": [
      "zap",
      "circle",
      "zapcircle",
      "zap circle"
    ]
  },
  {
    "name": "ZapFast",
    "label": "Zap Fast",
    "category": "Weather",
    "baseFamily": "ZapFast",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "ZapFast"
    ],
    "tags": [
      "zap",
      "fast",
      "instant",
      "flash",
      "speed",
      "turbo",
      "lightning",
      "zapfast",
      "zap fast"
    ]
  },
  {
    "name": "ZapOff",
    "label": "Zap Off",
    "category": "Weather",
    "baseFamily": "ZapOff",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "ZapOff"
    ],
    "tags": [
      "zap",
      "off",
      "zapoff",
      "zap off"
    ]
  },
  {
    "name": "ZapSquare",
    "label": "Zap Square",
    "category": "Weather",
    "baseFamily": "ZapSquare",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "ZapSquare"
    ],
    "tags": [
      "zap",
      "square",
      "zapsquare",
      "zap square"
    ]
  },
  {
    "name": "ZoomIn",
    "label": "Zoom In",
    "category": "General",
    "baseFamily": "ZoomIn",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "ZoomIn"
    ],
    "tags": [
      "zoom",
      "in",
      "zoomin",
      "zoom in"
    ]
  },
  {
    "name": "ZoomOut",
    "label": "Zoom Out",
    "category": "General",
    "baseFamily": "ZoomOut",
    "isFirstVariant": true,
    "variantCount": 1,
    "familyVariants": [
      "ZoomOut"
    ],
    "tags": [
      "zoom",
      "out",
      "zoomout",
      "zoom out"
    ]
  }
];

export const ALL_UNTITLED_UI_ICON_NAMES: string[] = UNTITLED_UI_ICONS.map(item => item.name);

export const UNTITLED_UI_PRIMARY_ICONS: UntitledUiIconItem[] = UNTITLED_UI_ICONS.filter(item => item.isFirstVariant);

export const UNTITLED_UI_ICON_MAP = new Map<string, UntitledUiIconItem>(
  UNTITLED_UI_ICONS.map(item => [item.name.toLowerCase(), item])
);

/**
 * Fast search and filter for Untitled UI icons
 */
export function searchUntitledUiIcons(
  term: string,
  category: string = 'View all',
  firstVariantOnly: boolean = false
): UntitledUiIconItem[] {
  const normalized = term.trim().toLowerCase();
  const filterCat = category === 'View all' ? null : category.toLowerCase();

  return UNTITLED_UI_ICONS.filter(item => {
    if (firstVariantOnly && !item.isFirstVariant) {
      return false;
    }
    if (filterCat && item.category.toLowerCase() !== filterCat) {
      return false;
    }
    if (!normalized) {
      return true;
    }

    if (item.name.toLowerCase().includes(normalized)) return true;
    if (item.label.toLowerCase().includes(normalized)) return true;
    if (item.category.toLowerCase().includes(normalized)) return true;
    if (item.baseFamily.toLowerCase().includes(normalized)) return true;
    return item.tags.some(tag => tag.includes(normalized));
  });
}

/**
 * Group a list of icons by category according to official UNTITLED_UI_CATEGORIES order
 */
export function groupIconsByCategory(icons: UntitledUiIconItem[]): { category: string; icons: UntitledUiIconItem[] }[] {
  const groups: Record<string, UntitledUiIconItem[]> = {};

  for (const icon of icons) {
    if (!groups[icon.category]) {
      groups[icon.category] = [];
    }
    groups[icon.category].push(icon);
  }

  const result: { category: string; icons: UntitledUiIconItem[] }[] = [];

  for (const cat of UNTITLED_UI_CATEGORIES) {
    if (cat === 'View all') continue;
    if (groups[cat] && groups[cat].length > 0) {
      result.push({
        category: cat,
        icons: groups[cat],
      });
    }
  }

  for (const cat in groups) {
    if (!UNTITLED_UI_CATEGORIES.includes(cat as any) && groups[cat].length > 0) {
      result.push({
        category: cat,
        icons: groups[cat],
      });
    }
  }

  return result;
}
