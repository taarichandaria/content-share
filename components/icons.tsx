type IconProps = React.SVGProps<SVGSVGElement>;

function base(props: IconProps): IconProps {
  return {
    width: 20,
    height: 20,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.75,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
    ...props,
  };
}

export function FeedIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 5h16M4 9.5h16M4 14h10M4 18.5h7" />
    </svg>
  );
}

export function BookIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 6.5C10.5 5 8.5 4.5 5 4.5v14c3.5 0 5.5.5 7 2 1.5-1.5 3.5-2 7-2v-14c-3.5 0-5.5.5-7 2Z" />
      <path d="M12 6.5v14" />
    </svg>
  );
}

export function FriendsIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="9" cy="8" r="3.25" />
      <path d="M3.5 19.5c.7-3.2 2.8-5 5.5-5s4.8 1.8 5.5 5" />
      <circle cx="17" cy="9.5" r="2.5" />
      <path d="M16.5 14.8c2.2.3 3.6 1.7 4.1 4.2" />
    </svg>
  );
}

export function PersonIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5.5 20c.8-3.7 3.3-5.7 6.5-5.7s5.7 2 6.5 5.7" />
    </svg>
  );
}

export function GearIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3.5v2.2M12 18.3v2.2M3.5 12h2.2M18.3 12h2.2M6 6l1.6 1.6M16.4 16.4 18 18M18 6l-1.6 1.6M7.6 16.4 6 18" />
    </svg>
  );
}

export function BookmarkIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M7 4.5h10a.5.5 0 0 1 .5.5v15l-5.5-3.7L6.5 20V5a.5.5 0 0 1 .5-.5Z" />
    </svg>
  );
}

export function CommentIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M21 12a8.5 8.5 0 0 1-8.5 8.5c-1.5 0-3-.4-4.2-1.1L3 21l1.6-5.3A8.5 8.5 0 1 1 21 12Z" />
    </svg>
  );
}

export function LinkIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M10 14a3.5 3.5 0 0 0 5 0l4-4a3.5 3.5 0 0 0-5-5l-1.8 1.8" />
      <path d="M14 10a3.5 3.5 0 0 0-5 0l-4 4a3.5 3.5 0 0 0 5 5l1.8-1.8" />
    </svg>
  );
}
