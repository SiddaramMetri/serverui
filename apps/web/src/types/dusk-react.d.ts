declare module "dusk-react" {
  import type { ComponentType, SVGProps } from "react";

  export type DuskIconProps = SVGProps<SVGSVGElement> & {
    size?: number;
    bg?: string;
    fg?: string;
    fg2?: string;
    circle?: boolean;
  };

  export const Finder: ComponentType<DuskIconProps>;
  export const Finder3: ComponentType<DuskIconProps>;
  export const Terminal: ComponentType<DuskIconProps>;
  export const Xcode: ComponentType<DuskIconProps>;
  export const Launchpad: ComponentType<DuskIconProps>;
  export const Safari: ComponentType<DuskIconProps>;
  export const TablePlus: ComponentType<DuskIconProps>;
  export const SystemPreferences: ComponentType<DuskIconProps>;
  export const Trash: ComponentType<DuskIconProps>;
}
