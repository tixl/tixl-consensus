import React, { useEffect, useContext } from 'react';
import { cloneDeep } from 'lodash';
import { SocketContext } from './SocketContext';
import classnames from 'classnames';

export type setSlicesFunc = (slices: Slices) => void;
export type Slices = Array<Map<string, boolean>>

const ClientList: React.FC<{ clients: string[], slices: Slices, setSlices: setSlicesFunc }> = ({ clients, slices, setSlices }) => {
    const { clientId } = useContext(SocketContext);

    const handleAddSlice = () => {
        setSlices([...slices, new Map(clients.map(c => ([c, false])))])
    }

    const handleCheckboxChange = (sliceId: number, client: string, value: boolean) => () => {
        const _slices = cloneDeep(slices);
        _slices[sliceId].set(client, !value);
        setSlices(_slices);
    }

    useEffect(() => {
        const _slices = cloneDeep(slices);
        let changes = false
        _slices.forEach(slice => {
            clients.forEach(client => {
                if (!slice.has(client)) {
                    slice.set(client, false)
                    changes = client === clientId ? true : false
                }

            })
        })
        if (changes) setSlices(_slices);
    }, [slices, clients])

    const ClientRow = ({ name }: { name: string }) => (
        <div className={classnames("flex p-1", (name === clientId) && "bg-orange-200")}>
            <div className="w-16">{name}</div>
            {slices.map((slice, sliceId) => slice.has(name) ?
                (<div className="w-16"><input disabled={name === clientId} type="checkbox" onChange={handleCheckboxChange(sliceId, name, slice.get(name)!)} checked={slice.get(name)!} /></div>) :
                (<div />)
            )}
        </div>
    )

    return (
        <div className="bg-gray-100 m-4 rounded shadow p-4">
            <h2 className="font-semibold text-xl">Slices</h2>
            <div className="flex h-12">
                <div className="w-16" />
                {slices.map((slice, idx) => (<div className="w-16">Slice {idx + 1} </div>))}
                <div className="w-16"><button className="bg-green-300 px-2 py-1 rounded" onClick={handleAddSlice}>+ slice</button></div>

            </div>
            <div className="flex-row">
                {clients.map(client => <ClientRow name={client} />)}
            </div>
        </div>
    );
}

export default ClientList;
