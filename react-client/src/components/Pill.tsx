import React from 'react';
import classnames from 'classnames';

const Pill: React.FC<{ className?: string }> = ({ children, className }) => {
    return (
        <p className={classnames("inline-block rounded-full px-2 mr-2 text-sm", className)}>{children}</p>
    );
}

export default Pill;
